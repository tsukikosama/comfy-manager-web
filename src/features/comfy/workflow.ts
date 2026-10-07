import type { ComfyNodeBinding } from '@/apis/comfy'

/**
 * ComfyUI 工作流解析与参数应用
 *
 * 第一版核心执行格式为 API prompt JSON；普通 UI workflow JSON 可保存，
 * 但需要用户提供 API 导出才能执行。
 */

/** API prompt 中的节点结构 */
export interface ComfyPromptNode {
  class_type: string
  inputs: Record<string, unknown>
  _meta?: { title?: string }
}

export type ComfyApiPrompt = Record<string, ComfyPromptNode>

/** 常见参数中文标签（按 class_type.input_name 匹配） */
const LABEL_MAP: Record<string, string> = {
  'KSampler.seed': '种子',
  'KSampler.steps': '步数',
  'KSampler.cfg': 'CFG',
  'KSampler.sampler_name': '采样器',
  'KSampler.scheduler': '调度器',
  'KSampler.denoise': '降噪强度',
  'KSamplerAdvanced.noise_seed': '种子',
  'CheckpointLoaderSimple.ckpt_name': '模型',
  'EmptyLatentImage.width': '宽度',
  'EmptyLatentImage.height': '高度',
  'EmptyLatentImage.batch_size': '节点批量',
  'EmptySD3LatentImage.width': '宽度',
  'EmptySD3LatentImage.height': '高度',
  'CLIPTextEncode.text': '提示词',
  'LoadImage.image': '输入图',
  'VAELoader.vae_name': 'VAE',
  'LoraLoader.lora_name': 'LoRA',
  'LoraLoader.strength_model': 'LoRA 强度',
}

/** 需要作为参数暴露的输入项（其余保持原样，不猜测用途） */
const SUPPORTED_INPUTS: Record<string, Array<string>> = {
  KSampler: ['seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise'],
  KSamplerAdvanced: ['noise_seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise'],
  CheckpointLoaderSimple: ['ckpt_name'],
  EmptyLatentImage: ['width', 'height', 'batch_size'],
  EmptySD3LatentImage: ['width', 'height', 'batch_size'],
  CLIPTextEncode: ['text'],
  LoadImage: ['image'],
  VAELoader: ['vae_name'],
  LoraLoader: ['lora_name', 'strength_model'],
}

/** 解析 API prompt 文本 */
export function parseApiPrompt(text: string): ComfyApiPrompt {
  const parsed = JSON.parse(text) as ComfyApiPrompt
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('API prompt 必须是一个 JSON 对象')
  }
  return parsed
}

/** 判断是否为 API prompt（节点含 class_type 与 inputs） */
export function isApiPrompt(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  return Object.values(value as Record<string, unknown>).some((node) => {
    const item = node as Record<string, unknown>
    return !!item && typeof item === 'object' && 'class_type' in item && 'inputs' in item
  })
}

/** 推断参数类型 */
function inferParamType(classType: string, inputName: string, value: unknown): ComfyNodeBinding['paramType'] {
  if (classType === 'LoadImage' && inputName === 'image') return 'IMAGE'
  if (typeof value === 'boolean') return 'BOOLEAN'
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'INT' : 'NUMBER'
  }
  return 'STRING'
}

/** 由 API prompt 生成参数绑定（只输出已识别且存在的字段） */
export function buildNodeBindings(prompt: ComfyApiPrompt): ComfyNodeBinding[] {
  const bindings: ComfyNodeBinding[] = []
  Object.entries(prompt).forEach(([nodeId, node]) => {
    if (!node || typeof node !== 'object') return
    const classType = node.class_type
    const names = SUPPORTED_INPUTS[classType]
    if (!names) return
    names.forEach((inputName) => {
      const inputs = node.inputs || {}
      if (!(inputName in inputs)) return
      const value = inputs[inputName]
      const key = `${classType}.${inputName}`
      bindings.push({
        nodeId,
        classType,
        inputName,
        label: LABEL_MAP[key] || `${classType}.${inputName}`,
        paramType: inferParamType(classType, inputName, value),
        defaultValue: typeof value === 'object' ? undefined : value,
      })
    })
  })
  return bindings
}

/**
 * 把参数值应用到 API prompt
 *
 * 只覆盖绑定中明确声明且已校验的字段，不按同名字段猜测节点用途，也不改动连线
 * （值为数组表示连线，跳过）。
 */
export function applyParams(prompt: ComfyApiPrompt, bindings: ComfyNodeBinding[], params: Record<string, unknown>): ComfyApiPrompt {
  const next: ComfyApiPrompt = JSON.parse(JSON.stringify(prompt)) as ComfyApiPrompt
  bindings.forEach((binding) => {
    const key = `${binding.nodeId}.${binding.inputName}`
    if (!(key in params)) return
    const node = next[binding.nodeId]
    if (!node || !node.inputs) return
    if (Array.isArray(node.inputs[binding.inputName])) return
    const value = params[key]
    if (value === undefined || value === null || value === '') return
    if (binding.paramType === 'INT') {
      node.inputs[binding.inputName] = Number.parseInt(String(value), 10)
    } else if (binding.paramType === 'NUMBER') {
      node.inputs[binding.inputName] = Number.parseFloat(String(value))
    } else {
      node.inputs[binding.inputName] = value
    }
  })
  return next
}

/** 判断某输入是否为连线（值为 [nodeId, outputIndex]） */
export function isLinkedInput(value: unknown): boolean {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === 'string'
}
