import { defineStore } from 'pinia'
import { reactive } from 'vue'

/**
 * ComfyUI 本地输出记录
 *
 * 后端当前只提供任务输出的查询接口（输出由回报收集流程写入），尚未提供写入接口，
 * 因此浏览器在任务成功后从 ComfyUI /history 收集到的输出引用保存在本地，
 * 供「任务输出」页面在没有云端记录时仍能预览与下载。
 */
export interface ComfyLocalOutput {
  key: string
  taskId: number
  taskBatchId?: number
  promptId?: string
  /** 原目标地址（来自任务快照，不随实例配置变化） */
  endpointUrl: string
  filename: string
  subfolder: string
  type: string
  nodeId?: string
  createdAt: string
}

const MAX_LOCAL_OUTPUTS = 500

const storeSetup = () => {
  const outputs = reactive<ComfyLocalOutput[]>([])

  /** 记录一次任务收集到的输出（按 taskId 覆盖，避免重复） */
  const saveOutputs = (taskId: number, endpointUrl: string, refs: Array<Omit<ComfyLocalOutput, 'key' | 'taskId' | 'endpointUrl' | 'createdAt'>>, promptId?: string) => {
    const createdAt = new Date().toISOString()
    const next = outputs.filter((item) => item.taskId !== taskId)
    refs.forEach((ref, index) => {
      next.unshift({
        ...ref,
        key: `${taskId}-${ref.filename}-${ref.subfolder}-${index}`,
        taskId,
        endpointUrl,
        promptId,
        createdAt,
      })
    })
    outputs.splice(0, outputs.length, ...next.slice(0, MAX_LOCAL_OUTPUTS))
  }

  const removeByTask = (taskId: number) => {
    const next = outputs.filter((item) => item.taskId !== taskId)
    outputs.splice(0, outputs.length, ...next)
  }

  const clear = () => {
    outputs.splice(0, outputs.length)
  }

  return { outputs, saveOutputs, removeByTask, clear }
}

export const useComfyStore = defineStore('comfy', storeSetup, { persist: true })
