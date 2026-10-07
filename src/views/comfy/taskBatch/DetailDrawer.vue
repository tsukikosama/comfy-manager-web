<template>
  <a-drawer v-model:visible="visible" title="任务批次详情" :width="width >= 900 ? 760 : '100%'" :footer="false">
    <a-spin :loading="loading" style="width: 100%">
      <a-descriptions :column="1" bordered size="medium">
        <a-descriptions-item label="批次ID">{{ data?.id }}</a-descriptions-item>
        <a-descriptions-item label="来源计划">{{ data?.scheduleId || '手动批次' }}</a-descriptions-item>
        <a-descriptions-item label="目标实例">{{ data?.instanceId }}</a-descriptions-item>
        <a-descriptions-item label="来源工作流">{{ data?.workflowId }}</a-descriptions-item>
        <a-descriptions-item label="触发时刻">{{ formatUtc(data?.scheduledAtUtc) }}</a-descriptions-item>
        <a-descriptions-item label="任务数">{{ data?.taskCount }}</a-descriptions-item>
        <a-descriptions-item label="状态">
          <GiCellTag :value="data?.status" :dict="COMFY_BATCH_STATUS" />
        </a-descriptions-item>
        <a-descriptions-item label="请求键">{{ data?.requestKey || '-' }}</a-descriptions-item>
        <a-descriptions-item label="创建时间">{{ formatUtc(data?.createTime) }}</a-descriptions-item>
        <a-descriptions-item label="修改时间">{{ formatUtc(data?.updateTime) }}</a-descriptions-item>
      </a-descriptions>

      <a-tabs style="margin-top: 16px">
        <a-tab-pane key="rule" title="运行规则">
          <JsonPretty v-if="isValidJson(data?.ruleJson)" :json="data?.ruleJson as string" />
          <a-empty v-else description="暂无运行规则" />
        </a-tab-pane>
        <a-tab-pane key="snapshot" title="执行快照">
          <JsonPretty v-if="isValidJson(data?.executionSnapshotJson)" :json="data?.executionSnapshotJson as string" />
          <a-empty v-else description="暂无执行快照" />
        </a-tab-pane>
      </a-tabs>
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { type ComfyTaskBatchResp, getComfyTaskBatch } from '@/apis/comfy'
import { COMFY_BATCH_STATUS } from '@/constant/comfy'
import { formatUtc } from '@/utils/comfy'

defineOptions({ name: 'ComfyTaskBatchDetailDrawer' })

const { width } = useWindowSize()

const visible = ref(false)
const loading = ref(false)
const data = ref<ComfyTaskBatchResp>()

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
    const { data: res } = await getComfyTaskBatch(id)
    data.value = res
  } finally {
    loading.value = false
  }
}

defineExpose({ onOpen })
</script>

<style scoped lang="scss"></style>
