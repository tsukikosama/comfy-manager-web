<template>
  <a-modal
    v-model:visible="visible"
    :title="title"
    :mask-closable="false"
    :esc-to-close="false"
    :width="width >= 700 ? 640 : '100%'"
    @before-ok="save"
    @close="reset"
  >
    <a-form ref="formRef" :model="form" :rules="rules" size="large" auto-label-width>
      <a-form-item label="实例名称" field="name">
        <a-input v-model="form.name" placeholder="请输入实例名称" :max-length="64" show-word-limit />
      </a-form-item>
      <a-form-item label="ComfyUI 地址" field="endpointUrl">
        <a-input v-model="form.endpointUrl" placeholder="如 http://127.0.0.1:8188 或 http://192.168.1.50:8188" />
      </a-form-item>
      <a-form-item label="设备UUID" field="deviceUuid" extra="站点存储中的随机标识，不是硬件身份；清理浏览器存储或换设备需重新绑定">
        <a-input v-model="form.deviceUuid" placeholder="留空则自动使用本机标识" readonly>
          <template #append>
            <a-button @click="onUseLocalDevice">使用本机</a-button>
          </template>
        </a-input>
      </a-form-item>
      <a-form-item label="连通性" :content-flex="false" hide-label>
        <a-space>
          <a-button :loading="checking" @click="onCheck">检测</a-button>
          <span v-if="checkText">{{ checkText }}</span>
        </a-space>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { type FormInstance, Message } from '@arco-design/web-vue'
import { useWindowSize } from '@vueuse/core'
import { type ComfyInstanceReq, type ComfyInstanceResp, addComfyInstance, updateComfyInstance } from '@/apis/comfy'
import { useResetReactive } from '@/hooks'
import { getSystemStats } from '@/features/comfy/client'
import { getDeviceUuid, resetDeviceUuid } from '@/utils/comfy'

defineOptions({ name: 'ComfyInstanceAddModal' })

const emit = defineEmits<{ (e: 'save-success'): void }>()

const { width } = useWindowSize()

const dataId = ref<number>()
const visible = ref(false)
const isUpdate = computed(() => !!dataId.value)
const title = computed(() => (isUpdate.value ? '修改实例' : '新增实例'))
const formRef = ref<FormInstance>()

const rules: FormInstance['rules'] = {
  name: [{ required: true, message: '请输入实例名称' }],
  endpointUrl: [{ required: true, message: '请输入 ComfyUI 地址' }],
}

const [form, resetForm] = useResetReactive<ComfyInstanceReq>({
  name: '',
  endpointUrl: '',
  deviceUuid: getDeviceUuid(),
})

const checking = ref(false)
const checkText = ref('')

// 使用本机设备标识
const onUseLocalDevice = () => {
  form.deviceUuid = resetDeviceUuid()
  Message.success('已重新生成并使用本机设备标识')
}

// 检测连通性
const onCheck = async () => {
  if (!form.endpointUrl) {
    Message.warning('请先填写 ComfyUI 地址')
    return
  }
  checking.value = true
  checkText.value = ''
  try {
    const stats = await getSystemStats(form.endpointUrl, { timeout: 8000 })
    const device = stats?.devices?.[0]
    checkText.value = `已连通：${device?.name || '未知设备'}`
  } catch (error) {
    checkText.value = (error as Error).message || '检测失败'
  } finally {
    checking.value = false
  }
}

// 重置
const reset = () => {
  formRef.value?.resetFields()
  checkText.value = ''
  resetForm()
  form.deviceUuid = getDeviceUuid()
}

// 新增
const onAdd = () => {
  reset()
  dataId.value = undefined
  visible.value = true
}

// 修改
const onUpdate = (record: ComfyInstanceResp) => {
  reset()
  dataId.value = record.id
  Object.assign(form, { name: record.name, endpointUrl: record.endpointUrl, deviceUuid: record.deviceUuid })
  visible.value = true
}

// 保存
const save = async () => {
  try {
    const isInvalid = await formRef.value?.validate()
    if (isInvalid) return false
    if (isUpdate.value) {
      await updateComfyInstance(form, dataId.value as number)
      Message.success('修改成功')
    } else {
      await addComfyInstance(form)
      Message.success('新增成功')
    }
    emit('save-success')
    return true
  } catch {
    return false
  }
}

defineExpose({ onAdd, onUpdate })
</script>

<style scoped lang="scss"></style>
