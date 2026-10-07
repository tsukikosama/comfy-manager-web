<template>
  <a-drawer v-model:visible="visible" title="计划触发预览" :width="width >= 800 ? 640 : '100%'" :footer="false">
    <a-spin :loading="loading" style="width: 100%">
      <a-descriptions :column="1" bordered size="medium">
        <a-descriptions-item label="下一次触发">{{ formatUtc(data?.nextRunAtUtc, '暂无') }}</a-descriptions-item>
        <a-descriptions-item label="最老等待任务">{{ formatUtc(data?.oldestWaitingScheduledAtUtc, '无') }}</a-descriptions-item>
        <a-descriptions-item label="积压数量">
          <a-tag v-if="(data?.backlogCount ?? 0) > 0" color="orangered">{{ data?.backlogCount }}</a-tag>
          <span v-else>0</span>
        </a-descriptions-item>
      </a-descriptions>

      <a-divider>未来五次触发</a-divider>
      <a-empty v-if="!data?.upcomingRuns?.length" description="暂无未来触发时间" />
      <a-list v-else size="small">
        <a-list-item v-for="(item, index) in data.upcomingRuns" :key="index">
          {{ index + 1 }}. {{ formatUtc(item) }}
        </a-list-item>
      </a-list>

      <a-divider>跳过未物化区间</a-divider>
      <a-alert type="warning" style="margin-bottom: 12px">
        仅当存在未物化的到期区间时才可跳过；跳过会推进补执行游标，该区间不再创建批次，操作会记入业务日志。
      </a-alert>
      <a-form :model="skipForm" layout="vertical">
        <a-form-item label="跳至时刻（本地时间）">
          <a-date-picker
            v-model="skipForm.until"
            show-time
            format="YYYY-MM-DD HH:mm:ss"
            placeholder="请选择跳至时刻"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="跳过原因">
          <a-input v-model="skipForm.reason" placeholder="如：旧触发点已无意义" :max-length="200" />
        </a-form-item>
        <a-space>
          <a-button type="primary" status="warning" :loading="skipping" @click="onSkip">确认跳过</a-button>
          <a-button @click="onReload">刷新预览</a-button>
        </a-space>
      </a-form>
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
import { Message } from '@arco-design/web-vue'
import { useWindowSize } from '@vueuse/core'
import { type ComfySchedulePreviewResp, previewComfySchedule, skipComfySchedule } from '@/apis/comfy'
import { formatUtc, toUtcText } from '@/utils/comfy'

defineOptions({ name: 'ComfySchedulePreviewDrawer' })

const { width } = useWindowSize()

const visible = ref(false)
const loading = ref(false)
const skipping = ref(false)
const scheduleId = ref<number>()
const data = ref<ComfySchedulePreviewResp>()
const skipForm = reactive({ until: '', reason: '' })

const load = async (id: number) => {
  loading.value = true
  try {
    const { data: res } = await previewComfySchedule(id)
    data.value = res
  } finally {
    loading.value = false
  }
}

const onOpen = async (id: number) => {
  scheduleId.value = id
  skipForm.until = ''
  skipForm.reason = ''
  visible.value = true
  await load(id)
}

const onReload = () => {
  if (scheduleId.value) load(scheduleId.value)
}

const onSkip = async () => {
  if (!scheduleId.value) return
  if (!skipForm.until) {
    Message.warning('请选择跳至时刻')
    return
  }
  skipping.value = true
  try {
    await skipComfySchedule(scheduleId.value, {
      untilUtc: toUtcText(skipForm.until),
      reason: skipForm.reason,
    })
    Message.success('已跳过该区间')
    await load(scheduleId.value)
  } catch (error) {
    Message.error((error as Error).message || '跳过失败')
  } finally {
    skipping.value = false
  }
}

defineExpose({ onOpen })
</script>

<style scoped lang="scss"></style>
