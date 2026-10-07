<template>
  <a-drawer v-model:visible="visible" title="网页执行引擎" :width="width >= 900 ? 640 : '100%'" :footer="false">
    <a-alert v-if="!state.active" type="normal" style="margin-bottom: 16px">
      当前没有启用执行。请在实例列表点击「启用本页执行」，领取该实例的任务并提交给本机或局域网 ComfyUI。
    </a-alert>
    <a-descriptions v-else :column="2" bordered size="medium" style="margin-bottom: 16px">
      <a-descriptions-item label="执行实例">{{ state.instanceName || state.instanceId }}</a-descriptions-item>
      <a-descriptions-item label="租约 epoch">{{ state.epoch }}</a-descriptions-item>
      <a-descriptions-item label="租约到期">{{ formatUtc(state.leaseExpiresAt) }}</a-descriptions-item>
      <a-descriptions-item label="状态">
        <a-space>
          <GiCellTag :value="state.active ? 1 : 2" :dict="COMFY_LEASE_STATUS" />
          <span v-if="state.busy">处理中</span>
        </a-space>
      </a-descriptions-item>
      <a-descriptions-item label="成功">{{ state.succeeded }}</a-descriptions-item>
      <a-descriptions-item label="失败">{{ state.failed }}</a-descriptions-item>
    </a-descriptions>

    <a-space wrap style="margin-bottom: 16px">
      <a-button v-if="state.active" type="primary" status="danger" @click="onStop">
        <template #icon><icon-stop /></template>
        <template #default>停止本页执行</template>
      </a-button>
      <a-button v-if="state.active" :loading="claiming" @click="onTick">
        <template #icon><icon-play-arrow /></template>
        <template #default>立即领取一次</template>
      </a-button>
      <a-button v-if="state.active" :loading="reconciling" @click="onReconcile">
        <template #icon><icon-sync /></template>
        <template #default>对账</template>
      </a-button>
      <a-button @click="clearLogs">
        <template #icon><icon-delete /></template>
        <template #default>清空日志</template>
      </a-button>
    </a-space>

    <a-typography-text bold>执行日志</a-typography-text>
    <div class="log-list">
      <a-empty v-if="!state.logs.length" description="暂无日志" />
      <div v-for="log in state.logs" :key="log.id" class="log-item">
        <span class="log-time">{{ log.time }}</span>
        <GiTag :status="levelStatus(log.level)" size="mini">{{ levelText(log.level) }}</GiTag>
        <span class="log-msg">{{ log.message }}</span>
      </div>
    </div>
  </a-drawer>
</template>

<script setup lang="ts">
import { Message } from '@arco-design/web-vue'
import { useWindowSize } from '@vueuse/core'
import { COMFY_LEASE_STATUS } from '@/constant/comfy'
import { useComfyExecutor } from '@/features/comfy/executor'
import { formatUtc } from '@/utils/comfy'

defineOptions({ name: 'ComfyExecutorDrawer' })

const { width } = useWindowSize()
const { state, stop, tick, reconcilePending, clearLogs } = useComfyExecutor()

const visible = ref(false)
const claiming = ref(false)
const reconciling = ref(false)

const levelStatus = (level: string): 'primary' | 'success' | 'warning' | 'danger' => {
  if (level === 'success') return 'success'
  if (level === 'warning') return 'warning'
  if (level === 'error') return 'danger'
  return 'primary'
}

const levelText = (level: string) => {
  if (level === 'success') return '成功'
  if (level === 'warning') return '警告'
  if (level === 'error') return '错误'
  return '信息'
}

const open = () => {
  visible.value = true
}

const onStop = async () => {
  await stop()
  Message.success('已停止本页执行')
}

const onTick = async () => {
  claiming.value = true
  try {
    await tick()
  } finally {
    claiming.value = false
  }
}

const onReconcile = async () => {
  reconciling.value = true
  try {
    await reconcilePending()
    Message.success('对账完成')
  } finally {
    reconciling.value = false
  }
}

defineExpose({ open })
</script>

<style scoped lang="scss">
.log-list {
  max-height: calc(100vh - 380px);
  overflow-y: auto;
  margin-top: 8px;
}

.log-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--color-neutral-3);
}

.log-time {
  flex-shrink: 0;
  color: var(--color-text-3);
  font-size: 12px;
}

.log-msg {
  flex: 1;
  word-break: break-all;
}
</style>
