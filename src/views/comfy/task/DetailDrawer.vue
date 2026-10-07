<template>
  <a-drawer
    v-model:visible="visible"
    title="任务详情"
    :width="width >= 900 ? 780 : '100%'"
    :footer="false"
    @close="onClose"
  >
    <a-spin :loading="loading" style="width: 100%">
      <a-descriptions :column="1" bordered size="medium">
        <a-descriptions-item label="任务ID">{{ data?.id }}</a-descriptions-item>
        <a-descriptions-item label="批次 / 项序">{{ data?.taskBatchId }} / {{ data?.itemIndex }}</a-descriptions-item>
        <a-descriptions-item label="状态">
          <GiCellTag :value="data?.status" :dict="COMFY_TASK_STATUS" />
        </a-descriptions-item>
        <a-descriptions-item label="计划触发时间">{{ formatUtc(data?.scheduledAtUtc) }}</a-descriptions-item>
        <a-descriptions-item label="目标地址（快照）">{{ data?.endpointUrl }}</a-descriptions-item>
        <a-descriptions-item label="目标设备">{{ data?.targetDeviceUuid || '-' }}</a-descriptions-item>
        <a-descriptions-item label="ComfyUI promptId">{{ data?.promptId || '-' }}</a-descriptions-item>
        <a-descriptions-item label="当前尝试号">{{ data?.currentAttemptNo }}</a-descriptions-item>
        <a-descriptions-item label="领取时间">{{ formatUtc(data?.claimedAt, '未领取') }}</a-descriptions-item>
        <a-descriptions-item label="提交时间">{{ formatUtc(data?.submittedAt, '未提交') }}</a-descriptions-item>
        <a-descriptions-item label="完成时间">{{ formatUtc(data?.finishedAt, '未完成') }}</a-descriptions-item>
      </a-descriptions>

      <a-space wrap style="margin: 16px 0">
        <a-popconfirm content="是否确定取消该任务？" type="warning" @ok="onCancel">
          <a-button v-permission="['comfy:task:cancel']" status="danger" :disabled="[7, 8, 12].includes(data?.status ?? 0)">
            取消任务
          </a-button>
        </a-popconfirm>
        <a-popconfirm content="UNKNOWN 任务重试可能产生重复生成，是否继续？" type="warning" @ok="onRetry">
          <a-button v-permission="['comfy:task:retry']" type="primary" :disabled="data?.status !== 9">重试</a-button>
        </a-popconfirm>
        <a-button v-permission="['comfy:task:reconcile']" :loading="reconciling" @click="onReconcile">按历史对账</a-button>
      </a-space>

      <a-tabs>
        <a-tab-pane key="prompt" title="最终 prompt">
          <JsonPretty v-if="isValidJson(data?.finalPromptJson)" :json="data?.finalPromptJson as string" />
          <a-empty v-else description="暂无 prompt" />
        </a-tab-pane>
        <a-tab-pane key="params" title="实际参数">
          <JsonPretty v-if="isValidJson(data?.actualParamsJson)" :json="data?.actualParamsJson as string" />
          <a-empty v-else description="暂无参数" />
        </a-tab-pane>
        <a-tab-pane key="output" title="输出文件">
          <a-empty v-if="!outputs.length" description="暂无本地输出记录（任务成功后由浏览器从 ComfyUI 历史收集）" />
          <a-row v-else :gutter="[12, 12]">
            <a-col v-for="item in outputs" :key="item.key" :xs="24" :sm="12" :md="8">
              <a-card hoverable size="small">
                <div class="preview-box">
                  <img v-if="previewMap[item.key]" :src="previewMap[item.key]" :alt="item.filename" />
                  <span v-else class="preview-placeholder">{{ item.filename }}</span>
                </div>
                <div class="file-name" :title="item.filename">{{ item.filename }}</div>
                <a-space size="mini">
                  <a-button size="mini" :loading="previewLoading === item.key" @click="onPreview(item)">预览</a-button>
                  <a-button size="mini" @click="onDownload(item)">下载</a-button>
                </a-space>
              </a-card>
            </a-col>
          </a-row>
        </a-tab-pane>
      </a-tabs>
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
import { Message } from '@arco-design/web-vue'
import { useWindowSize } from '@vueuse/core'
import {
  type ComfyTaskResp,
  cancelComfyTask,
  getComfyTask,
  reconcileComfyTask,
  retryComfyTask,
} from '@/apis/comfy'
import { COMFY_TASK_STATUS } from '@/constant/comfy'
import { type ComfyLocalOutput, useComfyStore } from '@/stores/modules/comfy'
import { buildViewUrl, downloadOutput, getHistory } from '@/features/comfy/client'
import { formatUtc, randomUuidHex } from '@/utils/comfy'

defineOptions({ name: 'ComfyTaskDetailDrawer' })

const emit = defineEmits<{ (e: 'save-success'): void }>()

const { width } = useWindowSize()
const comfyStore = useComfyStore()

const visible = ref(false)
const loading = ref(false)
const reconciling = ref(false)
const data = ref<ComfyTaskResp>()
const previewMap = reactive<Record<string, string>>({})
const previewLoading = ref('')

const outputs = computed<ComfyLocalOutput[]>(() => {
  if (!data.value) return []
  return comfyStore.outputs.filter((item) => item.taskId === data.value?.id)
})

const isValidJson = (text?: string) => {
  if (!text) return false
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

const onOpen = async (id: number) => {
  visible.value = true
  loading.value = true
  try {
    const { data: res } = await getComfyTask(id)
    data.value = res
  } finally {
    loading.value = false
  }
}

const onCancel = async () => {
  if (!data.value) return
  try {
    await cancelComfyTask(data.value.id, { reason: '用户在任务详情取消' })
    Message.success('已提交取消')
    emit('save-success')
    await onOpen(data.value.id)
  } catch (error) {
    Message.error((error as Error).message || '取消失败')
  }
}

const onRetry = async () => {
  if (!data.value) return
  try {
    await retryComfyTask(data.value.id, { requestUuid: randomUuidHex() })
    Message.success('已创建新的提交尝试')
    emit('save-success')
    await onOpen(data.value.id)
  } catch (error) {
    Message.error((error as Error).message || '重试失败')
  }
}

/** 按 ComfyUI /history 的实际结果补充证据 */
const onReconcile = async () => {
  if (!data.value) return
  if (!data.value.promptId) {
    Message.warning('该任务没有 promptId，无法按历史对账')
    return
  }
  reconciling.value = true
  try {
    const history = await getHistory(data.value.endpointUrl, data.value.promptId)
    if (!history?.status?.completed) {
      Message.warning('ComfyUI 历史中该任务尚未完成，暂不能定论')
      return
    }
    const failed = history.status.status_str === 'error'
    await reconcileComfyTask(data.value.id, {
      requestUuid: `${data.value.id}-${data.value.promptId}`,
      attemptNo: data.value.currentAttemptNo || 1,
      status: failed ? 3 : 2,
      promptId: data.value.promptId,
      errorMsg: failed ? '对账判定执行失败' : undefined,
      responseJson: JSON.stringify(history.status || {}),
    })
    Message.success(failed ? '对账为失败' : '对账为成功')
    emit('save-success')
    await onOpen(data.value.id)
  } catch (error) {
    Message.error((error as Error).message || '对账失败')
  } finally {
    reconciling.value = false
  }
}

const onPreview = async (item: ComfyLocalOutput) => {
  previewLoading.value = item.key
  try {
    // 直接使用 /view 地址预览，不再额外下载为 Blob（大文件更友好）
    previewMap[item.key] = buildViewUrl(item.endpointUrl, item)
  } finally {
    previewLoading.value = ''
  }
}

const onDownload = async (item: ComfyLocalOutput) => {
  try {
    await downloadOutput(item.endpointUrl, item)
  } catch (error) {
    Message.error((error as Error).message || '下载失败')
  }
}

/** 关闭抽屉时清理预览地址，避免残留引用 */
const onClose = () => {
  Object.keys(previewMap).forEach((key) => delete previewMap[key])
}

defineExpose({ onOpen, onClose })
</script>

<style scoped lang="scss">
.preview-box {
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-fill-1);
  overflow: hidden;

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
}

.preview-placeholder {
  font-size: 12px;
  color: var(--color-text-3);
  padding: 0 8px;
  word-break: break-all;
  text-align: center;
}

.file-name {
  margin: 8px 0;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
