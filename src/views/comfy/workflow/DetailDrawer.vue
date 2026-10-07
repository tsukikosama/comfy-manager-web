<template>
  <a-drawer v-model:visible="visible" title="工作流详情" :width="width >= 900 ? 760 : '100%'" :footer="false">
    <a-spin :loading="loading" style="width: 100%">
      <a-descriptions :column="1" bordered size="medium">
        <a-descriptions-item label="工作流名称">{{ data?.name }}</a-descriptions-item>
        <a-descriptions-item label="描述">{{ data?.description || '-' }}</a-descriptions-item>
        <a-descriptions-item label="状态">
          <GiCellTag :value="data?.status" :dict="COMFY_WORKFLOW_STATUS" />
        </a-descriptions-item>
        <a-descriptions-item label="配置版本">{{ data?.configRevision }}</a-descriptions-item>
        <a-descriptions-item label="创建时间">{{ formatUtc(data?.createTime) }}</a-descriptions-item>
        <a-descriptions-item label="修改时间">{{ formatUtc(data?.updateTime) }}</a-descriptions-item>
      </a-descriptions>

      <a-tabs style="margin-top: 16px">
        <a-tab-pane key="api" title="API prompt">
          <JsonPretty v-if="isValidJson(data?.apiPromptJson)" :json="data?.apiPromptJson as string" />
          <a-empty v-else description="暂无 API prompt" />
        </a-tab-pane>
        <a-tab-pane key="binding" title="参数绑定">
          <JsonPretty v-if="isValidJson(data?.nodeBindingsJson)" :json="data?.nodeBindingsJson as string" />
          <a-empty v-else description="暂无参数绑定" />
        </a-tab-pane>
        <a-tab-pane key="raw" title="UI workflow">
          <JsonPretty v-if="isValidJson(data?.rawWorkflowJson)" :json="data?.rawWorkflowJson as string" />
          <a-empty v-else description="暂无 UI workflow" />
        </a-tab-pane>
      </a-tabs>
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { type ComfyWorkflowResp, getComfyWorkflow } from '@/apis/comfy'
import { COMFY_WORKFLOW_STATUS } from '@/constant/comfy'
import { formatUtc } from '@/utils/comfy'

defineOptions({ name: 'ComfyWorkflowDetailDrawer' })

const { width } = useWindowSize()

const visible = ref(false)
const loading = ref(false)
const data = ref<ComfyWorkflowResp>()

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
    const { data: res } = await getComfyWorkflow(id)
    data.value = res
  } finally {
    loading.value = false
  }
}

defineExpose({ onOpen })
</script>

<style scoped lang="scss"></style>
