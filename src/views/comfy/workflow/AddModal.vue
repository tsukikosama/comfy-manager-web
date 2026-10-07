<template>
  <a-modal
    v-model:visible="visible"
    :title="title"
    :mask-closable="false"
    :esc-to-close="false"
    :width="width >= 900 ? 860 : '100%'"
    @before-ok="save"
    @close="reset"
  >
    <a-form ref="formRef" :model="form" :rules="rules" size="large" auto-label-width>
      <a-row :gutter="16">
        <a-col :xs="24" :sm="24" :md="12">
          <a-form-item label="工作流名称" field="name">
            <a-input v-model="form.name" placeholder="请输入工作流名称" :max-length="64" show-word-limit />
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="24" :md="12">
          <a-form-item label="状态" field="status">
            <a-select v-model="form.status" :options="COMFY_WORKFLOW_STATUS" placeholder="请选择状态" />
          </a-form-item>
        </a-col>
      </a-row>
      <a-form-item label="描述" field="description">
        <a-textarea
          v-model="form.description"
          placeholder="请输入描述"
          :max-length="200"
          show-word-limit
          :auto-size="{ minRows: 2, maxRows: 4 }"
        />
      </a-form-item>

      <a-tabs v-model:active-key="activeTab">
        <a-tab-pane key="api" title="API prompt（执行格式）">
          <a-space wrap style="margin-bottom: 8px">
            <a-upload :auto-upload="false" :show-file-list="false" accept=".json" @change="onImportApi">
              <template #upload-button>
                <a-button><template #icon><icon-upload /></template>导入 JSON</a-button>
              </template>
            </a-upload>
            <a-button @click="onFormatApi"><template #icon><icon-align-left /></template>格式化</a-button>
            <a-button type="primary" @click="onBuildBindings"><template #icon><icon-branch /></template>解析参数绑定</a-button>
          </a-space>
          <a-textarea
            v-model="form.apiPromptJson"
            placeholder="粘贴 ComfyUI 的 API prompt JSON，例如 {&quot;3&quot;:{&quot;class_type&quot;:&quot;KSampler&quot;,&quot;inputs&quot;:{...}}}"
            :auto-size="{ minRows: 8, maxRows: 16 }"
            class="json-textarea"
          />
          <a-typography-text type="secondary" size="small">
            第一版以 API prompt 作为执行格式；普通 UI workflow JSON 可保存，但没有 API 导出无法执行。
          </a-typography-text>
        </a-tab-pane>

        <a-tab-pane key="raw" title="UI workflow（可选）">
          <a-space wrap style="margin-bottom: 8px">
            <a-upload :auto-upload="false" :show-file-list="false" accept=".json" @change="onImportRaw">
              <template #upload-button>
                <a-button><template #icon><icon-upload /></template>导入 JSON</a-button>
              </template>
            </a-upload>
            <a-button @click="onFormatRaw"><template #icon><icon-align-left /></template>格式化</a-button>
          </a-space>
          <a-textarea
            v-model="form.rawWorkflowJson"
            placeholder="粘贴 ComfyUI 界面导出的 workflow JSON（仅作留存，不参与执行）"
            :auto-size="{ minRows: 8, maxRows: 16 }"
            class="json-textarea"
          />
        </a-tab-pane>

        <a-tab-pane key="binding" title="参数绑定">
          <a-empty v-if="!bindings.length" description="请在 API prompt 页签点击「解析参数绑定」" />
          <a-table v-else :data="bindings" :pagination="false" size="small" row-key="key">
            <template #columns>
              <a-table-column title="节点ID" data-index="nodeId" :width="80" />
              <a-table-column title="节点类型" data-index="classType" :width="160" />
              <a-table-column title="输入项" data-index="inputName" :width="120" />
              <a-table-column title="展示名称" data-index="label">
                <template #cell="{ record }">
                  <a-input v-model="record.label" size="mini" />
                </template>
              </a-table-column>
              <a-table-column title="类型" data-index="paramType" :width="90" />
              <a-table-column title="默认值" data-index="defaultValue" :width="120" ellipsis tooltip />
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { type FormInstance, Message } from '@arco-design/web-vue'
import { useWindowSize } from '@vueuse/core'
import { type ComfyNodeBinding, type ComfyWorkflowReq, type ComfyWorkflowResp, addComfyWorkflow, updateComfyWorkflow } from '@/apis/comfy'
import { COMFY_WORKFLOW_STATUS } from '@/constant/comfy'
import { useResetReactive } from '@/hooks'
import { buildNodeBindings, parseApiPrompt } from '@/features/comfy/workflow'

defineOptions({ name: 'ComfyWorkflowAddModal' })

const emit = defineEmits<{ (e: 'save-success'): void }>()

const { width } = useWindowSize()

const dataId = ref<number>()
const visible = ref(false)
const isUpdate = computed(() => !!dataId.value)
const title = computed(() => (isUpdate.value ? '修改工作流' : '新增工作流'))
const formRef = ref<FormInstance>()
const activeTab = ref('api')

const rules: FormInstance['rules'] = {
  name: [{ required: true, message: '请输入工作流名称' }],
  apiPromptJson: [{ required: true, message: '请输入 API prompt JSON' }],
}

const [form, resetForm] = useResetReactive<ComfyWorkflowReq>({
  name: '',
  description: '',
  rawWorkflowJson: '',
  apiPromptJson: '',
  nodeBindingsJson: '',
  status: 1,
})

type BindingRow = ComfyNodeBinding & { key: string }
const bindings = ref<BindingRow[]>([])

const readFile = async (file?: File): Promise<string | undefined> => {
  if (!file) return undefined
  return await file.text()
}

const onImportApi = async (fileList: unknown, fileItem: { file?: File }) => {
  const text = await readFile(fileItem?.file)
  if (!text) return
  form.apiPromptJson = text
  Message.success('已导入 API prompt')
}

const onImportRaw = async (fileList: unknown, fileItem: { file?: File }) => {
  const text = await readFile(fileItem?.file)
  if (!text) return
  form.rawWorkflowJson = text
  Message.success('已导入 UI workflow')
}

const formatJson = (text: string, field: 'apiPromptJson' | 'rawWorkflowJson', tip: string) => {
  if (!text) {
    Message.warning('内容为空')
    return
  }
  try {
    form[field] = JSON.stringify(JSON.parse(text), null, 2)
    Message.success('已格式化')
  } catch (error) {
    Message.error(`${tip}：${(error as Error).message}`)
  }
}

const onFormatApi = () => formatJson(form.apiPromptJson || '', 'apiPromptJson', 'API prompt 不是合法 JSON')
const onFormatRaw = () => formatJson(form.rawWorkflowJson || '', 'rawWorkflowJson', 'UI workflow 不是合法 JSON')

// 解析参数绑定
const onBuildBindings = () => {
  if (!form.apiPromptJson) {
    Message.warning('请先填写 API prompt JSON')
    return
  }
  try {
    const prompt = parseApiPrompt(form.apiPromptJson)
    bindings.value = buildNodeBindings(prompt).map((item, index) => ({
      ...item,
      key: `${item.nodeId}-${item.inputName}-${index}`,
    }))
    activeTab.value = 'binding'
    Message.success(`已解析出 ${bindings.value.length} 个可配置参数`)
  } catch (error) {
    Message.error(`解析失败：${(error as Error).message}`)
  }
}

const reset = () => {
  formRef.value?.resetFields()
  bindings.value = []
  activeTab.value = 'api'
  resetForm()
}

const onAdd = () => {
  reset()
  dataId.value = undefined
  visible.value = true
}

const onUpdate = (record: ComfyWorkflowResp) => {
  reset()
  dataId.value = record.id
  Object.assign(form, {
    name: record.name,
    description: record.description,
    rawWorkflowJson: record.rawWorkflowJson,
    apiPromptJson: record.apiPromptJson,
    nodeBindingsJson: record.nodeBindingsJson,
    status: record.status,
  })
  try {
    bindings.value = (JSON.parse(record.nodeBindingsJson || '[]') as ComfyNodeBinding[]).map((item, index) => ({
      ...item,
      key: `${item.nodeId}-${item.inputName}-${index}`,
    }))
  } catch {
    bindings.value = []
  }
  visible.value = true
}

const save = async () => {
  try {
    const isInvalid = await formRef.value?.validate()
    if (isInvalid) return false
    // 校验 API prompt 合法性，避免保存无法执行的工作流
    parseApiPrompt(form.apiPromptJson)
    const payload: ComfyWorkflowReq = {
      ...form,
      nodeBindingsJson: JSON.stringify(bindings.value.map(({ key, ...rest }) => rest)),
    }
    if (isUpdate.value) {
      await updateComfyWorkflow(payload, dataId.value as number)
      Message.success('修改成功')
    } else {
      await addComfyWorkflow(payload)
      Message.success('新增成功')
    }
    emit('save-success')
    return true
  } catch (error) {
    Message.error((error as Error).message || '保存失败')
    return false
  }
}

defineExpose({ onAdd, onUpdate })
</script>

<style scoped lang="scss">
.json-textarea {
  font-family: Menlo, Consolas, 'Courier New', monospace;
  font-size: 12px;
}
</style>
