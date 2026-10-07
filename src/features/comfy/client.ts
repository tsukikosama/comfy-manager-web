/**
 * 浏览器直连 ComfyUI 客户端
 *
 * 网页在「执行模式」下直接调用本机或局域网 ComfyUI，文件不经过云端传输。
 * 云端令牌不会发送给 ComfyUI：所有请求均为无凭据的跨域请求（credentials: 'omit'）。
 *
 * 覆盖接口：/system_stats、/object_info、/prompt、/queue、/history/{prompt_id}、
 * /upload/image、/view。
 */

/** 输出文件引用 */
export interface ComfyOutputRef {
  filename: string
  subfolder: string
  type: string
  /** 产出节点 ID */
  nodeId?: string
}

export interface ComfySystemStats {
  system?: {
    os?: string
    python_version?: string
    comfyui_version?: string
    [key: string]: unknown
  }
  devices?: Array<{
    name?: string
    type?: string
    vram_total?: number
    vram_free?: number
    torch_vram_total?: number
    torch_vram_free?: number
    [key: string]: unknown
  }>
  [key: string]: unknown
}

export interface ComfyPromptResp {
  prompt_id: string
  number?: number
  node_errors?: Record<string, unknown>
}

export interface ComfyQueueResp {
  queue_running?: Array<unknown>
  queue_pending?: Array<unknown>
}

export interface ComfyHistoryItem {
  prompt?: Array<unknown>
  outputs?: Record<string, Record<string, Array<ComfyOutputRef> | unknown>>
  status?: {
    status_str?: string
    completed?: boolean
    messages?: Array<Array<unknown>>
  }
}

export type ComfyHistoryResp = Record<string, ComfyHistoryItem>

export interface ComfyUploadImageResp {
  name: string
  subfolder?: string
  type?: string
}

/**
 * 直连请求错误
 *
 * status 存在表示 ComfyUI 明确返回了错误响应（可认为请求已被服务端处理且未执行），
 * 这类故障可以安全重试；没有 status 的通常是网络中断或跨域失败，
 * 请求可能已经发出，不能盲目重提。
 */
export class ComfyRequestError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ComfyRequestError'
    this.status = status
  }
}

/** 是否为「明确未被接收」的故障（服务端已返回错误响应） */
export function isExplicitReject(error: unknown): boolean {
  return error instanceof ComfyRequestError && error.status !== undefined
}

/** 预览/下载单文件大小上限（开发文档建议首期 50MB） */
export const COMFY_MAX_VIEW_SIZE = 50 * 1024 * 1024

/** 默认请求超时（毫秒） */
const DEFAULT_TIMEOUT = 15 * 1000

/** 归一化地址：去掉结尾斜杠 */
export function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '')
}

/** 拼接 /view 地址 */
export function buildViewUrl(endpoint: string, ref: ComfyOutputRef, preview?: string): string {
  const params = new URLSearchParams()
  params.set('filename', ref.filename)
  params.set('subfolder', ref.subfolder || '')
  params.set('type', ref.type || 'output')
  if (preview) params.set('preview', preview)
  return `${normalizeEndpoint(endpoint)}/view?${params.toString()}`
}

interface RequestOptions {
  timeout?: number
  signal?: AbortSignal
}

/**
 * 发起直连请求
 *
 * @param endpoint ComfyUI 地址
 * @param path 接口路径（以 / 开头）
 * @param init fetch 配置
 * @param options 超时等附加配置
 */
async function request<T>(
  endpoint: string,
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> {
  const url = `${normalizeEndpoint(endpoint)}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeout ?? DEFAULT_TIMEOUT)
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  try {
    const resp = await fetch(url, {
      ...init,
      mode: 'cors',
      // 绝不把云端登录态带到 ComfyUI
      credentials: 'omit',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init.headers || {}),
      },
    })
    if (!resp.ok) {
      let detail = ''
      try {
        const text = await resp.text()
        detail = text ? `：${text.slice(0, 300)}` : ''
      } catch {
        detail = ''
      }
      throw new ComfyRequestError(`ComfyUI 请求失败（${resp.status}）${detail}`, resp.status)
    }
    if (resp.status === 204) return undefined as T
    return await resp.json() as T
  } catch (error) {
    if (error instanceof ComfyRequestError) {
      throw error
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('ComfyUI 请求超时，请检查地址与网络')
    }
    // 跨域或网络失败时浏览器不返回具体状态，这里给出可操作的提示
    if (error instanceof TypeError) {
      throw new TypeError('无法访问 ComfyUI：请确认地址可访问、ComfyUI 已启动并允许本网页跨域访问')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/** 检测连通性并获取系统信息（/system_stats） */
export function getSystemStats(endpoint: string, options?: RequestOptions): Promise<ComfySystemStats> {
  return request<ComfySystemStats>(endpoint, '/system_stats', { method: 'GET' }, options)
}

/** 获取节点信息（/object_info） */
export function getObjectInfo(endpoint: string, options?: RequestOptions): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(endpoint, '/object_info', { method: 'GET' }, options)
}

/** 提交 prompt（/prompt） */
export function submitPrompt(
  endpoint: string,
  payload: { prompt: Record<string, unknown>, client_id?: string, extra_data?: Record<string, unknown> },
  options?: RequestOptions,
): Promise<ComfyPromptResp> {
  return request<ComfyPromptResp>(endpoint, '/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, options)
}

/** 查询队列（/queue） */
export function getQueue(endpoint: string, options?: RequestOptions): Promise<ComfyQueueResp> {
  return request<ComfyQueueResp>(endpoint, '/queue', { method: 'GET' }, options)
}

/** 查询指定 prompt 的执行历史（/history/{prompt_id}） */
export async function getHistory(
  endpoint: string,
  promptId: string,
  options?: RequestOptions,
): Promise<ComfyHistoryItem | undefined> {
  const data = await request<ComfyHistoryResp>(endpoint, `/history/${promptId}`, { method: 'GET' }, options)
  return data?.[promptId]
}

/** 上传输入图片（/upload/image），返回 ComfyUI 侧实际文件引用 */
export async function uploadImage(
  endpoint: string,
  file: File,
  options?: { subfolder?: string, overwrite?: boolean, timeout?: number },
): Promise<ComfyUploadImageResp> {
  const formData = new FormData()
  formData.append('image', file)
  if (options?.overwrite !== false) {
    formData.append('overwrite', String(options?.overwrite ?? true))
  }
  if (options?.subfolder) {
    formData.append('subfolder', options.subfolder)
  }
  return request<ComfyUploadImageResp>(endpoint, '/upload/image', {
    method: 'POST',
    body: formData,
    // 让浏览器自动补全 multipart boundary
    headers: {},
  }, { timeout: options?.timeout ?? 60 * 1000 })
}

/**
 * 读取 /view 二进制内容（用于预览与下载）
 *
 * 调用方必须在使用完 objectURL 后调用 URL.revokeObjectURL 释放。
 */
export async function fetchViewBlob(
  endpoint: string,
  ref: ComfyOutputRef,
  options?: RequestOptions,
): Promise<Blob> {
  const url = buildViewUrl(endpoint, ref)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options?.timeout ?? 60 * 1000)
  try {
    const resp = await fetch(url, { mode: 'cors', credentials: 'omit', signal: controller.signal })
    if (!resp.ok) {
      throw new ComfyRequestError(`读取输出文件失败（${resp.status}）`, resp.status)
    }
    const blob = await resp.blob()
    if (blob.size > COMFY_MAX_VIEW_SIZE) {
      throw new Error(`输出文件超过 ${COMFY_MAX_VIEW_SIZE / 1024 / 1024}MB，暂不支持在页面内预览`)
    }
    return blob
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('读取输出文件超时')
    }
    if (error instanceof TypeError) {
      throw new TypeError('无法读取输出文件：请确认本机 ComfyUI 可访问且文件未被删除')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/** 生成预览用的 objectURL（图片/视频均可用） */
export async function createPreviewUrl(
  endpoint: string,
  ref: ComfyOutputRef,
  options?: RequestOptions,
): Promise<string> {
  const blob = await fetchViewBlob(endpoint, ref, options)
  return URL.createObjectURL(blob)
}

/** 下载输出文件到本地（不经云端） */
export async function downloadOutput(
  endpoint: string,
  ref: ComfyOutputRef,
  options?: RequestOptions,
): Promise<void> {
  const blob = await fetchViewBlob(endpoint, ref, options)
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = ref.filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** 从执行历史中提取输出文件引用 */
export function extractOutputs(history?: ComfyHistoryItem): ComfyOutputRef[] {
  if (!history?.outputs) return []
  const list: ComfyOutputRef[] = []
  Object.entries(history.outputs).forEach(([nodeId, nodeOutput]) => {
    Object.entries(nodeOutput || {}).forEach(([key, value]) => {
      if (!Array.isArray(value)) return
      value.forEach((item) => {
        const ref = item as ComfyOutputRef
        if (ref && typeof ref.filename === 'string') {
          list.push({
            filename: ref.filename,
            subfolder: ref.subfolder || '',
            type: ref.type || 'output',
            nodeId,
          })
        }
      })
      // 记录输出键名，便于区分 images / gifs / audio 等
      void key
    })
  })
  return list
}
