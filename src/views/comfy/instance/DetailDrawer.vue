<template>
  <a-drawer v-model:visible="visible" title="实例详情" :width="width >= 800 ? 620 : '100%'" :footer="false">
    <a-spin :loading="loading" style="width: 100%">
      <a-descriptions :column="1" bordered size="medium">
        <a-descriptions-item label="实例名称">{{ data?.name }}</a-descriptions-item>
        <a-descriptions-item label="ComfyUI 地址">{{ data?.endpointUrl }}</a-descriptions-item>
        <a-descriptions-item label="设备UUID">{{ data?.deviceUuid || '-' }}</a-descriptions-item>
        <a-descriptions-item label="配置版本">{{ data?.configRevision }}</a-descriptions-item>
        <a-descriptions-item label="当前执行页">{{ data?.pageUuid || '-' }}</a-descriptions-item>
        <a-descriptions-item label="租约 epoch">{{ data?.leaseEpoch }}</a-descriptions-item>
        <a-descriptions-item label="执行租约">
          <GiCellTag :value="data?.leaseStatus" :dict="COMFY_LEASE_STATUS" />
        </a-descriptions-item>
        <a-descriptions-item label="租约到期">{{ formatUtc(data?.leaseExpiresAt) }}</a-descriptions-item>
        <a-descriptions-item label="最后心跳">{{ formatUtc(data?.lastHeartbeatAt) }}</a-descriptions-item>
        <a-descriptions-item label="实例状态">
          <GiCellTag :value="data?.status" :dict="COMFY_INSTANCE_STATUS" />
        </a-descriptions-item>
        <a-descriptions-item label="创建时间">{{ formatUtc(data?.createTime) }}</a-descriptions-item>
        <a-descriptions-item label="修改时间">{{ formatUtc(data?.updateTime) }}</a-descriptions-item>
      </a-descriptions>

      <a-divider>连通性</a-divider>
      <a-space wrap>
        <a-button :loading="checking" @click="onCheck">检测 ComfyUI</a-button>
        <span v-if="checkText">{{ checkText }}</span>
      </a-space>
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { type ComfyInstanceResp, getComfyInstance } from '@/apis/comfy'
import { COMFY_INSTANCE_STATUS, COMFY_LEASE_STATUS } from '@/constant/comfy'
import { getSystemStats } from '@/features/comfy/client'
import { formatUtc } from '@/utils/comfy'

defineOptions({ name: 'ComfyInstanceDetailDrawer' })

const { width } = useWindowSize()

const visible = ref(false)
const loading = ref(false)
const data = ref<ComfyInstanceResp>()
const checking = ref(false)
const checkText = ref('')

const onOpen = async (id: number) => {
  visible.value = true
  checkText.value = ''
  loading.value = true
  try {
    const { data: res } = await getComfyInstance(id)
    data.value = res
  } finally {
    loading.value = false
  }
}

const onCheck = async () => {
  if (!data.value?.endpointUrl) return
  checking.value = true
  checkText.value = ''
  try {
    const stats = await getSystemStats(data.value.endpointUrl, { timeout: 8000 })
    const device = stats?.devices?.[0]
    checkText.value = `已连通：${device?.name || '未知设备'}`
  } catch (error) {
    checkText.value = (error as Error).message || '检测失败'
  } finally {
    checking.value = false
  }
}

defineExpose({ onOpen })
</script>

<style scoped lang="scss"></style>
