<template>
  <a-drawer v-model:visible="visible" title="计划详情" :width="width >= 900 ? 760 : '100%'" :footer="false">
    <a-spin :loading="loading" style="width: 100%">
      <a-descriptions :column="1" bordered size="medium">
        <a-descriptions-item label="计划名称">{{ data?.name }}</a-descriptions-item>
        <a-descriptions-item label="运行方式">
          <GiCellTag :value="data?.runMode" :dict="COMFY_RUN_MODE" />
        </a-descriptions-item>
        <a-descriptions-item label="时区">{{ data?.timezone }}</a-descriptions-item>
        <a-descriptions-item label="目标实例">{{ data?.instanceId }}</a-descriptions-item>
        <a-descriptions-item label="工作流">{{ data?.workflowId }}</a-descriptions-item>
        <a-descriptions-item label="每次任务数">{{ data?.taskCountPerRun }}</a-descriptions-item>
        <a-descriptions-item label="积压上限">{{ data?.backlogLimit }}</a-descriptions-item>
        <a-descriptions-item label="下次触发">{{ formatUtc(data?.nextRunAtUtc, '无') }}</a-descriptions-item>
        <a-descriptions-item label="补执行游标">{{ formatUtc(data?.scanCursorUtc, '无') }}</a-descriptions-item>
        <a-descriptions-item label="存在未物化区间">
          <a-tag v-if="data?.hasUnmaterialized" color="orange">是</a-tag>
          <span v-else>否</span>
        </a-descriptions-item>
        <a-descriptions-item label="状态">
          <GiCellTag :value="data?.status" :dict="COMFY_SCHEDULE_STATUS" />
        </a-descriptions-item>
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
        <a-tab-pane key="params" title="参数与素材">
          <JsonPretty v-if="isValidJson(data?.paramsJson)" :json="data?.paramsJson as string" />
          <a-empty v-else description="暂无参数" />
          <JsonPretty v-if="isValidJson(data?.materialRefsJson)" :json="data?.materialRefsJson as string" />
        </a-tab-pane>
      </a-tabs>
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { type ComfyScheduleResp, getComfySchedule } from '@/apis/comfy'
import { COMFY_RUN_MODE, COMFY_SCHEDULE_STATUS } from '@/constant/comfy'
import { formatUtc } from '@/utils/comfy'

defineOptions({ name: 'ComfyScheduleDetailDrawer' })

const { width } = useWindowSize()

const visible = ref(false)
const loading = ref(false)
const data = ref<ComfyScheduleResp>()

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
    const { data: res } = await getComfySchedule(id)
    data.value = res
  } finally {
    loading.value = false
  }
}

defineExpose({ onOpen })
</script>

<style scoped lang="scss"></style>
