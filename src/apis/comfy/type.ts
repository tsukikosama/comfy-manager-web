/**
 * ComfyUI 模块类型定义
 *
 * 字段与后端 top.continew.admin.system.model.*.comfy 下的
 * Req / Resp / Query 一一对应。后端时间统一为 UTC，页面按计划时区展示。
 */

/** 分页查询参数 */
export interface ComfyPageQuery {
  page?: number
  size?: number
  sort?: Array<string>
}

/** ------------------ 实例 ------------------ */

/** 实例状态（1：启用；2：禁用） */
export type InstanceStatus = 1 | 2
/** 执行租约状态（1：在线；2：离线） */
export type InstanceLeaseStatus = 1 | 2

export interface ComfyInstanceResp {
  id: number
  name: string
  endpointUrl: string
  deviceUuid: string
  configRevision: number
  pageUuid: string
  leaseEpoch: number
  leaseStatus: InstanceLeaseStatus
  leaseExpiresAt: string
  lastHeartbeatAt: string
  status: InstanceStatus
  createTime: string
  updateTime: string
}

export interface ComfyInstanceReq {
  name: string
  endpointUrl: string
  deviceUuid?: string
}

export interface ComfyInstanceQuery extends ComfyPageQuery {
  name?: string
  status?: InstanceStatus
  leaseStatus?: InstanceLeaseStatus
}
export type ComfyInstancePageQuery = ComfyInstanceQuery

/** 租约请求（获取/续期） */
export interface ComfyLeaseReq {
  /** 执行页 UUID */
  pageUuid: string
  /** 设备 UUID */
  deviceUuid: string
  /** 登录令牌摘要（SHA-256 十六进制文本） */
  loginTokenDigest: string
  /** 租约有效期（秒），默认 60 */
  ttlSeconds?: number
}

export interface ComfyLeaseResp {
  instanceId: number
  epoch: number
  leaseStatus: InstanceLeaseStatus
  leaseExpiresAt: string
}

/** ------------------ 工作流 ------------------ */

/** 工作流状态（1：草稿；2：就绪） */
export type WorkflowStatus = 1 | 2

export interface ComfyWorkflowResp {
  id: number
  name: string
  description: string
  rawWorkflowJson: string
  apiPromptJson: string
  nodeBindingsJson: string
  configRevision: number
  status: WorkflowStatus
  createTime: string
  updateTime: string
}

export interface ComfyWorkflowReq {
  name: string
  description?: string
  rawWorkflowJson?: string
  apiPromptJson: string
  nodeBindingsJson?: string
  status?: WorkflowStatus
}

export interface ComfyWorkflowQuery extends ComfyPageQuery {
  name?: string
  status?: WorkflowStatus
}
export type ComfyWorkflowPageQuery = ComfyWorkflowQuery

/** 参数绑定项（nodeBindingsJson 的结构） */
export interface ComfyNodeBinding {
  /** 节点 ID */
  nodeId: string
  /** 节点类型，如 KSampler */
  classType: string
  /** 输入项名称，如 seed */
  inputName: string
  /** 前端展示标签 */
  label: string
  /** 参数类型：string / number / int / boolean / image */
  paramType: 'STRING' | 'NUMBER' | 'INT' | 'BOOLEAN' | 'IMAGE'
  /** 默认值 */
  defaultValue?: unknown
}

/** ------------------ 计划 ------------------ */

/** 运行方式 */
export type RunMode = 'ONCE' | 'DAILY' | 'WEEKLY' | 'INTERVAL'
/** 计划状态（1：启用；2：阻塞；3：暂停；4：草稿；5：已归档） */
export type ScheduleStatus = 1 | 2 | 3 | 4 | 5

/**
 * 运行规则（ruleJson 结构，均为用户本地墙钟时间）
 * - ONCE: { onceAt }
 * - DAILY: { dailyTime }
 * - WEEKLY: { dailyTime, weeklyDays }
 * - INTERVAL: { intervalMinutes, intervalFrom }
 */
export interface ComfyScheduleRule {
  onceAt?: string
  dailyTime?: string
  weeklyDays?: Array<number>
  intervalMinutes?: number
  intervalFrom?: string
}

export interface ComfyScheduleResp {
  id: number
  name: string
  instanceId: number
  workflowId: number
  runMode: RunMode
  timezone: string
  ruleJson: string
  fixedTargetJson: string
  executionSnapshotJson: string
  paramsJson: string
  materialRefsJson: string
  taskCountPerRun: number
  backlogLimit: number
  nextRunAtUtc: string
  scanCursorUtc: string
  hasUnmaterialized: boolean
  status: ScheduleStatus
  configRevision: number
  createTime: string
  updateTime: string
}

export interface ComfyScheduleReq {
  name: string
  instanceId: number
  workflowId: number
  runMode: RunMode
  timezone: string
  ruleJson?: string
  paramsJson?: string
  materialRefsJson?: string
  taskCountPerRun?: number
  backlogLimit?: number
  status?: ScheduleStatus
}

export interface ComfyScheduleQuery extends ComfyPageQuery {
  name?: string
  status?: ScheduleStatus
  instanceId?: number
  workflowId?: number
}
export type ComfySchedulePageQuery = ComfyScheduleQuery

export interface ComfySchedulePreviewResp {
  nextRunAtUtc: string
  upcomingRuns: Array<string>
  oldestWaitingScheduledAtUtc: string
  backlogCount: number
}

export interface ComfyScheduleSkipReq {
  /** 跳至该时刻（UTC，含）之前的区间不再物化，格式 yyyy-MM-ddTHH:mm:ss */
  untilUtc: string
  reason?: string
}

/** ------------------ 任务批次 ------------------ */

/** 批次状态（1：等待；2：部分成功；3：完成；4：失败） */
export type BatchStatus = 1 | 2 | 3 | 4

export interface ComfyTaskBatchResp {
  id: number
  scheduleId: number
  instanceId: number
  workflowId: number
  scheduledAtUtc: string
  ruleJson: string
  executionSnapshotJson: string
  taskCount: number
  requestKey: string
  status: BatchStatus
  createTime: string
  updateTime: string
}

export interface ComfyTaskBatchQuery extends ComfyPageQuery {
  scheduleId?: number
  instanceId?: number
  status?: BatchStatus
}
export type ComfyTaskBatchPageQuery = ComfyTaskBatchQuery

/** ------------------ 任务 ------------------ */

/** 任务状态 */
export type TaskStatus =
  | 1 // 等待浏览器
  | 2 // 就绪
  | 3 // 已领取
  | 4 // 提交中
  | 5 // 已提交
  | 6 // 运行中
  | 7 // 成功
  | 8 // 失败
  | 9 // 未知
  | 10 // 对账中
  | 11 // 已请求取消
  | 12 // 已取消
  | 13 // 阻塞

/** 尝试状态（1：发送中；2：成功；3：失败；4：未知） */
export type AttemptStatus = 1 | 2 | 3 | 4
/** 发送意图（1：提交；2：重试；3：对账；4：取消） */
export type AttemptSendIntent = 1 | 2 | 3 | 4

export interface ComfyTaskResp {
  id: number
  scheduleId: number
  taskBatchId: number
  instanceId: number
  workflowId: number
  itemIndex: number
  scheduledAtUtc: string
  actualParamsJson: string
  finalPromptJson: string
  endpointUrl: string
  targetDeviceUuid: string
  status: TaskStatus
  versionNo: number
  currentAttemptNo: number
  claimToken: string
  claimPageUuid: string
  claimDeviceUuid: string
  claimEpoch: number
  claimedAt: string
  submittedAt: string
  promptId: string
  finishedAt: string
  createTime: string
  updateTime: string
}

export interface ComfyTaskQuery extends ComfyPageQuery {
  scheduleId?: number
  taskBatchId?: number
  instanceId?: number
  status?: TaskStatus
}
export type ComfyTaskPageQuery = ComfyTaskQuery

export interface ComfyClaimReq {
  pageUuid: string
  deviceUuid: string
  epoch: number
  claimToken?: string
}

export interface ComfyTaskClaimResp {
  taskId: number
  itemIndex: number
  claimToken: string
  epoch: number
  endpointUrl: string
  targetDeviceUuid: string
  actualParamsJson: string
  finalPromptJson: string
}

export interface ComfySubmitIntentReq {
  actualPromptJson: string
  requestKey: string
  requestUuid: string
}

export interface ComfyReportReq {
  requestUuid: string
  attemptNo: number
  status: AttemptStatus
  promptId?: string
  errorMsg?: string
  responseJson?: string
  actualPromptJson?: string
}

export interface ComfyReconcileReq {
  requestUuid: string
  attemptNo: number
  status: AttemptStatus
  promptId?: string
  errorMsg?: string
  responseJson?: string
}

export interface ComfyCancelReq {
  reason?: string
}

export interface ComfyRetryReq {
  /** 新请求 UUID（十六进制），同任务唯一 */
  requestUuid: string
  actualPromptJson?: string
}

/** ------------------ 任务输出 ------------------ */

/** 收集状态（1：待收集；2：已收集；3：收集失败） */
export type OutputCollectStatus = 1 | 2 | 3
/** 可用性（1：可用；2：不可用；3：已删除） */
export type OutputAvailability = 1 | 2 | 3

export interface ComfyTaskOutputResp {
  id: number
  taskId: number
  taskBatchId: number
  attemptId: number
  filename: string
  subfolder: string
  type: string
  nodeId: string
  endpointUrl: string
  mediaInfoJson: string
  collectStatus: OutputCollectStatus
  availability: OutputAvailability
  createTime: string
  updateTime: string
}

export interface ComfyTaskOutputQuery extends ComfyPageQuery {
  taskId?: number
  taskBatchId?: number
}
export type ComfyTaskOutputPageQuery = ComfyTaskOutputQuery
