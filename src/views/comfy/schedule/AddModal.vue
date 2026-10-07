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
      <fieldset>
        <legend>基础配置</legend>
        <a-row :gutter="16">
          <a-col :xs="24" :sm="24" :md="12">
            <a-form-item label="计划名称" field="name">
              <a-input v-model="form.name" placeholder="请输入计划名称" :max-length="64" show-word-limit />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="24" :md="12">
            <a-form-item label="状态" field="status">
              <a-select v-model="form.status" :options="COMFY_SCHEDULE_STATUS" placeholder="请选择状态" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="24" :md="12">
            <a-form-item label="目标实例" field="instanceId">
              <a-select
                v-model="form.instanceId"
                :options="instanceOptions"
                placeholder="请选择固定目标实例"
                allow-search
                @change="onInstanceChange"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="24" :md="12">
            <a-form-item label="工作流" field="workflowId">
              <a-select
                v-model="form.workflowId"
                :options="workflowOptions"
                placeholder="请选择工作流"
                allow-search
                @change="onWorkflowChange"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </fieldset>

      <fieldset>
        <legend>运行规则</legend>
        <a-row :gutter="16">
          <a-col :xs="24" :sm="24" :md="12">
            <a-form-item label="运行方式" field="runMode">
              <a-select v-model="form.runMode" :options="COMFY_RUN_MODE" placeholder="请选择运行方式" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="24" :md="12">
            <a-form-item label="时区" field="timezone">
              <a-select v-model="form.timezone" :options="COMFY_TIMEZONES" placeholder="请选择时区" allow-search />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row v-if="form.runMode === 'ONCE'" :gutter="16">
          <a-col :span="24">
            <a-form-item label="执行时间" field="onceAt">
              <a-date-picker
                v-model="onceAtPicker"
                show-time
                format="YYYY-MM-DD HH:mm:ss"
                placeholder="请选择执行时间"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row v-if="form.runMode === 'DAILY'" :gutter="16">
          <a-col :xs="24" :sm="24" :md="12">
            <a-form-item label="每日时间" field="dailyTime">
              <a-time-picker v-model="rule.dailyTime" format="HH:mm" placeholder="请选择时间" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row v-if="form.runMode === 'WEEKLY'" :gutter="16">
          <a-col :xs="24" :sm="24" :md="12">
            <a-form-item label="每周时间" field="weeklyTime">
              <a-time-picker v-model="weeklyTime" format="HH:mm" placeholder="请选择时间" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="24" :md="12">
            <a-form-item label="星期" field="weeklyDays">
              <a-select v-model="rule.weeklyDays" :options="COMFY_WEEK_DAYS" placeholder="请选择星期" multiple />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row v-if="form.runMode === 'INTERVAL'" :gutter="16">
          <a-col :xs="24" :sm="24" :md="12">
            <a-form-item label="间隔分钟" field="intervalMinutes">
              <a-input-number v-model="rule.intervalMinutes" :min="1" placeholder="请输入间隔分钟" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="24" :md="12">
            <a-form-item label="起始时间" field="intervalFrom">
              <a-date-picker
                v-model="intervalFromPicker"
                show-time
                format="YYYY-MM-DD HH:mm:ss"
                placeholder="留空表示从当前开始"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :xs="24" :sm="24" :md="12">
            <a-form-item label="每次任务数" field="taskCountPerRun" extra="prompt 提交项数，与节点 batch_size 分开">
              <a-input-number v-model="form.taskCountPerRun" :min="1" :max="100" placeholder="请输入每次任务数" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="24" :md="12">
            <a-form-item label="积压上限" field="backlogLimit">
              <a-input-number v-model="form.backlogLimit" :min="1" :max="1000" placeholder="请输入积压上限" />
            </a-form-item>
          </a-col>
        </a-row>
      </fieldset>

      <fieldset>
        <legend>参数与素材</legend>
        <a-empty v-if="!bindings.length" description="选择工作流后，可在此配置已解析的参数与输入图" />
        <template v-else>
          <a-row v-for="binding in bindings" :key="`${binding.nodeId}-${binding.inputName}`" :gutter="16">
            <a-col :span="24">
              <a-form-item :label="`${binding.label}（${binding.nodeId}.${binding.inputName}）`">
                <a-space style="width: 100%">
                  <template v-if="binding.paramType === 'IMAGE'">
                    <a-input
                      :model-value="materialText(binding)"
                      placeholder="请上传输入图（由浏览器直接上传到目标 ComfyUI）"
                      readonly
                      style="width: 320px"
                    />
                    <a-upload :auto-upload="false" :show-file-list="false" accept="image/*" @change="(_l, item) => onUploadMaterial(binding, item)">
                      <template #upload-button>
                        <a-button :disabled="!form.instanceId">上传输入图</a-button>
                      </template>
                    </a-upload>
                  </template>
                  <a-input-number
                    v-else-if="binding.paramType === 'INT'"
                    v-model="params[paramKey(binding)]"
                    :min="0"
                    placeholder="留空则沿用工作流默认值"
                    style="width: 220px"
                  />
                  <a-input-number
                    v-else-if="binding.paramType === 'NUMBER'"
                    v-model="params[paramKey(binding)]"
                    :step="0.1"
                    placeholder="留空则沿用工作流默认值"
                    style="width: 220px"
                  />
                  <a-input
                    v-else
                    v-model="params[paramKey(binding)]"
                    placeholder="留空则沿用工作流默认值"
                    style="width: 320px"
                  />
                </a-space>
              </a-form-item>
            </a-col>
          </a-row>
        </template>
      </fieldset>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { type FormInstance, Message } from '@arco-design/web-vue'
import { useWindowSize } from '@vueuse/core'
import {
  type ComfyInstanceResp,
  type ComfyNodeBinding,
  type ComfyScheduleReq,
  type ComfyScheduleResp,
  type ComfyScheduleRule,
  type ComfyWorkflowResp,
  addComfySchedule,
  getComfyWorkflow,
  listComfyInstance,
  listComfyWorkflow,
  updateComfySchedule,
} from '@/apis/comfy'
import {
  COMFY_RUN_MODE,
  COMFY_SCHEDULE_STATUS,
  COMFY_TIMEZONES,
  COMFY_WEEK_DAYS,
} from '@/constant/comfy'
import { useResetReactive } from '@/hooks'
import { uploadImage } from '@/features/comfy/client'
import { parseJson, toLocalText } from '@/utils/comfy'

defineOptions({ name: 'ComfyScheduleAddModal' })

const emit = defineEmits<{ (e: 'save-success'): void }>()

const { width } = useWindowSize()

const dataId = ref<number>()
const visible = ref(false)
const isUpdate = computed(() => !!dataId.value)
const title = computed(() => (isUpdate.value ? '修改计划' : '新增计划'))
const formRef = ref<FormInstance>()

const rules: FormInstance['rules'] = {
  name: [{ required: true, message: '请输入计划名称' }],
  instanceId: [{ required: true, message: '请选择目标实例' }],
  workflowId: [{ required: true, message: '请选择工作流' }],
  runMode: [{ required: true, message: '请选择运行方式' }],
  timezone: [{ required: true, message: '请选择时区' }],
}

const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'

const [form, resetForm] = useResetReactive<ComfyScheduleReq>({
  name: '',
  instanceId: undefined as unknown as number,
  workflowId: undefined as unknown as number,
  runMode: 'DAILY',
  timezone: defaultTimezone,
  ruleJson: undefined,
  paramsJson: undefined,
  materialRefsJson: undefined,
  taskCountPerRun: 1,
  backlogLimit: 1000,
  status: 1,
})

/** 运行规则（本地墙钟时间） */
const rule = reactive<ComfyScheduleRule>({ dailyTime: '09:00', weeklyDays: [], intervalMinutes: 30 })
/** 日期时间选择器的原始值 */
const onceAtPicker = ref('')
const intervalFromPicker = ref('')
/** 每周时间与 rule.dailyTime 共用，避免切换模式时互相覆盖 */
const weeklyTime = ref('09:00')
/** 公共参数：key 为 nodeId.inputName（一张表承载多种参数类型，故用 any） */
const params = reactive<Record<string, any>>({})
/** 素材引用：key 为 nodeId.inputName */
const materials = reactive<Record<string, { filename: string, subfolder: string, type: string }>>({})
/** 工作流参数绑定 */
const bindings = ref<ComfyNodeBinding[]>([])

const instanceOptions = ref<Array<{ label: string, value: number }>>([])
const instanceMap = ref<Record<number, ComfyInstanceResp>>({})
const workflowOptions = ref<Array<{ label: string, value: number }>>([])

const paramKey = (binding: ComfyNodeBinding) => `${binding.nodeId}.${binding.inputName}`

const materialText = (binding: ComfyNodeBinding) => {
  const material = materials[paramKey(binding)]
  return material ? `${material.subfolder ? `${material.subfolder}/` : ''}${material.filename}` : ''
}

/** 加载实例与工作流下拉数据 */
const loadOptions = async () => {
  if (!instanceOptions.value.length) {
    const { data } = await listComfyInstance({ page: 1, size: 100 })
    instanceOptions.value = (data?.list || []).map((item: ComfyInstanceResp) => ({
      label: `${item.name}（${item.endpointUrl}）`,
      value: item.id,
    }))
    instanceMap.value = (data?.list || []).reduce((acc: Record<number, ComfyInstanceResp>, item: ComfyInstanceResp) => {
      acc[item.id] = item
      return acc
    }, {} as Record<number, ComfyInstanceResp>)
  }
  if (!workflowOptions.value.length) {
    const { data } = await listComfyWorkflow({ page: 1, size: 100, status: 2 })
    workflowOptions.value = (data?.list || []).map((item: ComfyWorkflowResp) => ({
      label: item.name,
      value: item.id,
    }))
    if (!workflowOptions.value.length) {
      const { data: all } = await listComfyWorkflow({ page: 1, size: 100 })
      workflowOptions.value = (all?.list || []).map((item: ComfyWorkflowResp) => ({ label: item.name, value: item.id }))
    }
  }
}

const onInstanceChange = () => {
  // 换目标后已上传的素材不再有效，需要重新上传（开发文档 4.3）
  Object.keys(materials).forEach((key) => delete materials[key])
}

const onWorkflowChange = async (value: unknown) => {
  const id = Number(value)
  bindings.value = []
  Object.keys(params).forEach((key) => delete params[key])
  Object.keys(materials).forEach((key) => delete materials[key])
  if (!id) return
  try {
    const { data } = await getComfyWorkflow(id)
    bindings.value = parseJson<ComfyNodeBinding[]>(data?.nodeBindingsJson, [])
  } catch {
    bindings.value = []
  }
}

/** 上传输入图到目标实例（浏览器直连，云端不接收图片内容） */
const onUploadMaterial = async (binding: ComfyNodeBinding, item: { file?: File }) => {
  const file = item?.file
  const instance = instanceMap.value[form.instanceId]
  if (!file || !instance) {
    Message.warning('请先选择目标实例并选择图片')
    return
  }
  try {
    const resp = await uploadImage(instance.endpointUrl, file)
    materials[paramKey(binding)] = {
      filename: resp.name,
      subfolder: resp.subfolder || '',
      type: resp.type || 'input',
    }
    Message.success('已上传并写入素材引用')
  } catch (error) {
    Message.error(`上传失败：${(error as Error).message}`)
  }
}

const buildRuleJson = (): string => {
  const payload: ComfyScheduleRule = {}
  if (form.runMode === 'ONCE') {
    payload.onceAt = toLocalText(onceAtPicker.value)
  } else if (form.runMode === 'DAILY') {
    payload.dailyTime = rule.dailyTime || '00:00'
  } else if (form.runMode === 'WEEKLY') {
    payload.dailyTime = weeklyTime.value || '00:00'
    payload.weeklyDays = rule.weeklyDays || []
  } else if (form.runMode === 'INTERVAL') {
    payload.intervalMinutes = rule.intervalMinutes || 30
    if (intervalFromPicker.value) {
      payload.intervalFrom = toLocalText(intervalFromPicker.value)
    }
  }
  return JSON.stringify(payload)
}

const reset = () => {
  formRef.value?.resetFields()
  Object.assign(rule, { dailyTime: '09:00', weeklyDays: [], intervalMinutes: 30 })
  onceAtPicker.value = ''
  intervalFromPicker.value = ''
  weeklyTime.value = '09:00'
  Object.keys(params).forEach((key) => delete params[key])
  Object.keys(materials).forEach((key) => delete materials[key])
  bindings.value = []
  resetForm()
}

const onAdd = async () => {
  reset()
  dataId.value = undefined
  await loadOptions()
  visible.value = true
}

const onUpdate = async (record: ComfyScheduleResp) => {
  reset()
  dataId.value = record.id
  await loadOptions()
  Object.assign(form, {
    name: record.name,
    instanceId: record.instanceId,
    workflowId: record.workflowId,
    runMode: record.runMode,
    timezone: record.timezone,
    taskCountPerRun: record.taskCountPerRun,
    backlogLimit: record.backlogLimit,
    status: record.status,
  })
  const savedRule = parseJson<ComfyScheduleRule>(record.ruleJson, {})
  Object.assign(rule, {
    dailyTime: savedRule.dailyTime || '09:00',
    weeklyDays: savedRule.weeklyDays || [],
    intervalMinutes: savedRule.intervalMinutes || 30,
  })
  onceAtPicker.value = savedRule.onceAt ? savedRule.onceAt.replace('T', ' ') : ''
  intervalFromPicker.value = savedRule.intervalFrom ? savedRule.intervalFrom.replace('T', ' ') : ''
  weeklyTime.value = savedRule.dailyTime || '09:00'
  Object.assign(params, parseJson<Record<string, unknown>>(record.paramsJson, {}))
  Object.assign(materials, parseJson<Record<string, { filename: string, subfolder: string, type: string }>>(record.materialRefsJson, {}))
  await onWorkflowChange(record.workflowId)
  visible.value = true
}

const save = async () => {
  try {
    const isInvalid = await formRef.value?.validate()
    if (isInvalid) return false
    const payload: ComfyScheduleReq = {
      ...form,
      ruleJson: buildRuleJson(),
      paramsJson: JSON.stringify(params),
      materialRefsJson: JSON.stringify(materials),
    }
    if (isUpdate.value) {
      await updateComfySchedule(payload, dataId.value as number)
      Message.success('修改成功')
    } else {
      await addComfySchedule(payload)
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
fieldset {
  padding: 15px 15px 0 15px;
  margin-bottom: 15px;
  border: 1px solid var(--color-neutral-3);
  border-radius: 3px;
}

fieldset legend {
  color: rgb(var(--gray-10));
  padding: 2px 5px;
  border: 1px solid var(--color-neutral-3);
  border-radius: 3px;
}
</style>
