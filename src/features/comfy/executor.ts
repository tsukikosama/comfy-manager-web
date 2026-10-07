import { computed, reactive } from 'vue'
import {
  type ComfyOutputRef,
  extractOutputs,
  getHistory,
  isExplicitReject,
  submitPrompt,
} from './client'
import {
  type ComfyTaskResp,
  acquireComfyLease,
  claimComfyTask,
  getComfyTask,
  heartbeatComfyInstance,
  listComfyTask,
  reconcileComfyTask,
  renewComfyLease,
  reportComfyTask,
  stopComfyLease,
  submitComfyTaskIntent,
} from '@/apis/comfy'
import { getDeviceUuid, getLoginTokenDigest, getPageUuid, parseJson, randomUuidHex } from '@/utils/comfy'
import { useComfyStore } from '@/stores/modules/comfy'

/**
 * 网页执行引擎（单例）
 *
 * 职责：启用本页执行（获取实例执行租约）→ 心跳与续期 → 领取任务 → 记录提交意图
 * → 浏览器直连 ComfyUI 提交 → 轮询队列/历史 → 回报状态 → 收集输出。
 *
 * 关键约束（开发文档 v0.3）：
 * - 云端令牌不发送给 ComfyUI，提交前先把 SUBMITTING 与实际 prompt 落到云端。
 * - 提交地址取任务原目标快照，不读取实例当前地址。
 * - 响应丢失/网络错误不盲目重提，无法证明未接收时保留 UNKNOWN。
 */

/** 心跳间隔（毫秒） */
const HEARTBEAT_INTERVAL = 10 * 1000
/** 租约续期间隔（毫秒，默认租约 60 秒） */
const RENEW_INTERVAL = 30 * 1000
/** 领取轮询间隔（毫秒） */
const LOOP_INTERVAL = 5 * 1000
/** 执行结果轮询间隔（毫秒） */
const POLL_INTERVAL = 3 * 1000
/** 执行结果轮询最大次数（约 10 分钟） */
const MAX_POLL_TIMES = 200
/** 明确未被接收时的退避重试间隔（毫秒） */
const RETRY_BACKOFF = [0, 5 * 1000, 15 * 1000, 45 * 1000]

/** 任务状态常量（与后端 TaskStatusEnum 一致） */
const TASK_STATUS = {
  WAITING_BROWSER: 1,
  READY: 2,
  CLAIMED: 3,
  SUBMITTING: 4,
  SUBMITTED: 5,
  RUNNING: 6,
  SUCCEEDED: 7,
  FAILED: 8,
  UNKNOWN: 9,
  RECONCILING: 10,
} as const

/** 尝试状态常量（与后端 AttemptStatusEnum 一致） */
const ATTEMPT_STATUS = {
  SENDING: 1,
  SUCCESS: 2,
  FAILED: 3,
  UNKNOWN: 4,
} as const

export interface ComfyExecutionLog {
  id: number
  time: string
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
  taskId?: number
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const state = reactive({
  /** 是否已启用本页执行 */
  active: false,
  /** 是否正在处理任务（同一实例同时只处理一个） */
  busy: false,
  instanceId: undefined as number | undefined,
  instanceName: '',
  endpointUrl: '',
  deviceUuid: '',
  pageUuid: '',
  epoch: 0,
  leaseExpiresAt: '',
  /** 当前处理的任务 ID */
  currentTaskId: undefined as number | undefined,
  succeeded: 0,
  failed: 0,
  logs: [] as ComfyExecutionLog[],
})

let heartbeatTimer: ReturnType<typeof setInterval> | undefined
let renewTimer: ReturnType<typeof setInterval> | undefined
let loopTimer: ReturnType<typeof setInterval> | undefined
let logSeq = 0

function pushLog(level: ComfyExecutionLog['level'], message: string, taskId?: number) {
  state.logs.unshift({
    id: ++logSeq,
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    level,
    message,
    taskId,
  })
  if (state.logs.length > 100) {
    state.logs.splice(100)
  }
}

function clearTimers() {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  if (renewTimer) clearInterval(renewTimer)
  if (loopTimer) clearInterval(loopTimer)
  heartbeatTimer = undefined
  renewTimer = undefined
  loopTimer = undefined
}

/** 领取顺序：计划触发时间 → 批次 ID → 任务项序号 */
function pickNextTask(list: ComfyTaskResp[]): ComfyTaskResp | undefined {
  if (!list.length) return undefined
  return [...list].sort((a, b) => {
    const t = (a.scheduledAtUtc || '').localeCompare(b.scheduledAtUtc || '')
    if (t !== 0) return t
    const b1 = (a.taskBatchId ?? 0) - (b.taskBatchId ?? 0)
    if (b1 !== 0) return b1
    return (a.itemIndex ?? 0) - (b.itemIndex ?? 0)
  })[0]
}

/**
 * 向 ComfyUI 提交 prompt
 *
 * 仅对「明确未被接收」的故障（服务端返回了错误响应）退避重试；
 * 网络中断类错误可能发生在发送之后，不重试，交由调用方置为 UNKNOWN。
 */
async function submitWithRetry(endpoint: string, prompt: Record<string, unknown>, pageUuid: string) {
  let lastError: unknown
  for (let i = 0; i < RETRY_BACKOFF.length; i++) {
    if (i > 0) {
      pushLog('warning', `第 ${i} 次重试提交（退避 ${RETRY_BACKOFF[i] / 1000} 秒）`)
      await sleep(RETRY_BACKOFF[i])
    }
    try {
      return await submitPrompt(endpoint, { prompt, client_id: pageUuid })
    } catch (error) {
      lastError = error
      if (!isExplicitReject(error)) {
        throw error
      }
    }
  }
  throw lastError ?? new Error('提交失败')
}

/** 收集输出：优先取任务快照地址，保存到本地输出记录 */
async function collectOutputs(endpoint: string, promptId: string, task: ComfyTaskResp) {
  try {
    const history = await getHistory(endpoint, promptId)
    const refs: ComfyOutputRef[] = extractOutputs(history)
    if (!refs.length) return
    useComfyStore().saveOutputs(task.id, task.endpointUrl || endpoint, refs.map((ref) => ({
      filename: ref.filename,
      subfolder: ref.subfolder,
      type: ref.type,
      nodeId: ref.nodeId,
      taskBatchId: task.taskBatchId,
    })), promptId)
    pushLog('success', `任务 ${task.id} 收集到 ${refs.length} 个输出文件`, task.id)
  } catch (error) {
    // 收集失败不重新生成，也不改变任务成功状态（开发文档第 7 节）
    pushLog('warning', `任务 ${task.id} 输出收集失败：${(error as Error).message}`, task.id)
  }
}

/** 轮询执行结果并回报终态 */
async function pollAndReport(task: ComfyTaskResp, requestUuid: string, attemptNo: number, endpoint: string, promptId: string) {
  for (let i = 0; i < MAX_POLL_TIMES; i++) {
    await sleep(POLL_INTERVAL)
    if (!state.active) {
      pushLog('warning', `执行已停止，任务 ${task.id} 的结果将在下次上线后对账`, task.id)
      return
    }
    let history
    try {
      history = await getHistory(endpoint, promptId)
    } catch (error) {
      // 轮询失败不视为任务失败，继续重试
      pushLog('warning', `任务 ${task.id} 轮询失败：${(error as Error).message}`, task.id)
      continue
    }
    if (!history?.status?.completed) continue
    const statusStr = history.status.status_str || ''
    if (statusStr === 'error') {
      const messages = (history.status.messages || [])
        .map((item) => item.map((v) => String(v)).join(' '))
        .join('；')
      await reportComfyTask(task.id, {
        requestUuid,
        attemptNo,
        status: ATTEMPT_STATUS.FAILED,
        promptId,
        errorMsg: messages || 'ComfyUI 执行失败',
        responseJson: JSON.stringify(history.status),
      })
      state.failed++
      pushLog('error', `任务 ${task.id} 执行失败：${messages || 'ComfyUI 执行失败'}`, task.id)
      return
    }
    await reportComfyTask(task.id, {
      requestUuid,
      attemptNo,
      status: ATTEMPT_STATUS.SUCCESS,
      promptId,
      responseJson: JSON.stringify(history.status || {}),
    })
    state.succeeded++
    pushLog('success', `任务 ${task.id} 执行成功`, task.id)
    await collectOutputs(endpoint, promptId, task)
    return
  }
  pushLog('warning', `任务 ${task.id} 轮询超时，仍在执行中`, task.id)
}

/** 执行单个任务：领取 → 提交意图 → 直连提交 → 轮询回报 */
async function runTask(task: ComfyTaskResp) {
  const requestUuid = randomUuidHex()
  state.currentTaskId = task.id
  pushLog('info', `开始处理任务 ${task.id}（第 ${task.itemIndex} 项）`, task.id)
  try {
    // 1. 领取：校验执行页、设备与租约 epoch
    const { data: claim } = await claimComfyTask(task.id, {
      pageUuid: state.pageUuid,
      deviceUuid: state.deviceUuid,
      epoch: state.epoch,
    })
    // 提交地址取任务原目标快照，不随实例当前配置变化
    const endpoint = claim.endpointUrl || task.endpointUrl || state.endpointUrl
    const prompt = parseJson<Record<string, unknown>>(claim.finalPromptJson, {})

    // 2. 记录提交意图：云端先落 SUBMITTING 与实际 prompt，之后才允许请求 ComfyUI
    await submitComfyTaskIntent(task.id, {
      actualPromptJson: claim.finalPromptJson,
      requestKey: requestUuid,
      requestUuid,
    })
    // 尝试号由服务端分配，回报前回读，避免与迟到回执错配
    const { data: detail } = await getComfyTask(task.id)
    const attemptNo = detail?.currentAttemptNo || (task.currentAttemptNo || 0) + 1

    // 3. 直连 ComfyUI 提交
    try {
      const resp = await submitWithRetry(endpoint, prompt, state.pageUuid)
      // ComfyUI 可能以 200 返回节点校验错误，这类提交不会进入队列，直接判失败
      const nodeErrors = resp?.node_errors && Object.keys(resp.node_errors).length ? resp.node_errors : undefined
      if (nodeErrors || !resp?.prompt_id) {
        await reportComfyTask(task.id, {
          requestUuid,
          attemptNo,
          status: ATTEMPT_STATUS.FAILED,
          errorMsg: nodeErrors ? `ComfyUI 节点校验失败：${JSON.stringify(nodeErrors)}` : 'ComfyUI 未返回 promptId',
          responseJson: JSON.stringify(resp || {}),
        })
        state.failed++
        pushLog('error', `任务 ${task.id} 被 ComfyUI 拒绝`, task.id)
        return
      }
      await reportComfyTask(task.id, {
        requestUuid,
        attemptNo,
        status: ATTEMPT_STATUS.SENDING,
        promptId: resp.prompt_id,
        responseJson: JSON.stringify(resp),
      })
      pushLog('info', `任务 ${task.id} 已提交，promptId=${resp.prompt_id}`, task.id)
      await pollAndReport(task, requestUuid, attemptNo, endpoint, resp.prompt_id)
    } catch (error) {
      const message = (error as Error).message || '提交失败'
      // 服务端明确拒绝 = 未被接收，可直接判失败；网络中断无法证明未接收 → UNKNOWN
      const explicit = isExplicitReject(error)
      await reportComfyTask(task.id, {
        requestUuid,
        attemptNo,
        status: explicit ? ATTEMPT_STATUS.FAILED : ATTEMPT_STATUS.UNKNOWN,
        errorMsg: message,
      })
      if (explicit) {
        state.failed++
        pushLog('error', `任务 ${task.id} 提交失败：${message}`, task.id)
      } else {
        pushLog('warning', `任务 ${task.id} 提交响应未知，已置为 UNKNOWN，请核对后再重试：${message}`, task.id)
      }
    }
  } catch (error) {
    pushLog('error', `任务 ${task.id} 处理异常：${(error as Error).message}`, task.id)
  } finally {
    state.currentTaskId = undefined
  }
}

/** 主循环：领取一个 READY 任务并执行 */
async function tick() {
  if (!state.active || state.busy || !state.instanceId) return
  state.busy = true
  try {
    const { data } = await listComfyTask({
      instanceId: state.instanceId,
      status: TASK_STATUS.READY,
      page: 1,
      size: 10,
    })
    const task = pickNextTask(data?.list || [])
    if (!task) return
    await runTask(task)
  } catch (error) {
    pushLog('error', `领取任务失败：${(error as Error).message}`)
  } finally {
    state.busy = false
  }
}

/** 对账：为已知 promptId 的未终态任务补充证据 */
async function reconcilePending() {
  if (!state.active || !state.instanceId) return
  const statuses = [TASK_STATUS.SUBMITTING, TASK_STATUS.RUNNING, TASK_STATUS.UNKNOWN, TASK_STATUS.RECONCILING]
  for (const status of statuses) {
    try {
      const { data } = await listComfyTask({ instanceId: state.instanceId, status, page: 1, size: 20 })
      for (const task of data?.list || []) {
        if (!task.promptId) continue
        const endpoint = task.endpointUrl || state.endpointUrl
        try {
          const history = await getHistory(endpoint, task.promptId)
          if (!history?.status?.completed) continue
          const failed = history.status.status_str === 'error'
          await reconcileComfyTask(task.id, {
            requestUuid: `${task.id}-${task.promptId}`,
            attemptNo: task.currentAttemptNo || 1,
            status: failed ? ATTEMPT_STATUS.FAILED : ATTEMPT_STATUS.SUCCESS,
            promptId: task.promptId,
            errorMsg: failed ? '对账判定执行失败' : undefined,
            responseJson: JSON.stringify(history.status || {}),
          })
          pushLog(failed ? 'error' : 'success', `任务 ${task.id} 对账完成`, task.id)
          if (!failed) await collectOutputs(endpoint, task.promptId, task)
        } catch (error) {
          pushLog('warning', `任务 ${task.id} 对账失败：${(error as Error).message}`, task.id)
        }
      }
    } catch (error) {
      pushLog('warning', `查询待对账任务失败：${(error as Error).message}`)
    }
  }
}

/**
 * 启用本页执行
 *
 * @param instance 目标实例（地址取实例当前配置，用于心跳展示；提交地址仍以任务快照为准）
 */
async function start(instance: { id: number, name?: string, endpointUrl?: string }) {
  if (state.active && state.instanceId === instance.id) return
  if (state.active) await stop()
  const deviceUuid = getDeviceUuid()
  const pageUuid = getPageUuid()
  const { data } = await acquireComfyLease(instance.id, {
    pageUuid,
    deviceUuid,
    loginTokenDigest: getLoginTokenDigest(),
    ttlSeconds: 60,
  })
  state.active = true
  state.instanceId = instance.id
  state.instanceName = instance.name || ''
  state.endpointUrl = instance.endpointUrl || ''
  state.deviceUuid = deviceUuid
  state.pageUuid = pageUuid
  state.epoch = data?.epoch ?? 0
  state.leaseExpiresAt = data?.leaseExpiresAt || ''
  state.succeeded = 0
  state.failed = 0
  pushLog('success', `已启用本页执行：${instance.name || instance.id}（epoch=${state.epoch}）`)

  heartbeatTimer = setInterval(() => {
    if (!state.instanceId) return
    heartbeatComfyInstance(state.instanceId).catch((error) => {
      pushLog('warning', `心跳失败：${(error as Error).message}`)
    })
  }, HEARTBEAT_INTERVAL)

  renewTimer = setInterval(async () => {
    if (!state.instanceId) return
    try {
      const { data: renewed } = await renewComfyLease(state.instanceId, {
        pageUuid: state.pageUuid,
        deviceUuid: state.deviceUuid,
        loginTokenDigest: getLoginTokenDigest(),
        ttlSeconds: 60,
      })
      state.leaseExpiresAt = renewed?.leaseExpiresAt || ''
    } catch (error) {
      pushLog('warning', `租约续期失败：${(error as Error).message}`)
    }
  }, RENEW_INTERVAL)

  loopTimer = setInterval(() => {
    tick()
  }, LOOP_INTERVAL)

  // 上线先对账旧尝试，再领取新任务（开发文档 5.3）
  await reconcilePending()
  await tick()
}

/** 停止本页执行 */
async function stop() {
  const instanceId = state.instanceId
  clearTimers()
  state.active = false
  state.busy = false
  state.currentTaskId = undefined
  if (instanceId) {
    try {
      await stopComfyLease(instanceId)
      pushLog('info', '已停止本页执行，租约置为离线')
    } catch (error) {
      pushLog('warning', `停止租约失败：${(error as Error).message}`)
    }
  }
}

/** 清空执行日志 */
function clearLogs() {
  state.logs.splice(0, state.logs.length)
}

/** 网页执行引擎（全局单例状态） */
export function useComfyExecutor() {
  return {
    state,
    /** 是否有实例正在执行 */
    isActive: computed(() => state.active),
    start,
    stop,
    tick,
    reconcilePending,
    clearLogs,
    pushLog,
  }
}

export { TASK_STATUS, ATTEMPT_STATUS }
