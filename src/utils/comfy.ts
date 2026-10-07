import sha256 from 'crypto-js/sha256'
import dayjs from 'dayjs'
import { getAccessToken } from '@/features/auth-session/access-token'

/**
 * ComfyUI 模块本地标识与签名工具
 *
 * - 设备 UUID：站点存储中的随机标识，不是硬件身份；清理存储或换设备需重新绑定。
 * - 执行页 UUID：每个标签页独立，用于云端判定「一个实例只有一个活动执行页」。
 */

const DEVICE_UUID_KEY = 'comfy_device_uuid'
const PAGE_UUID_KEY = 'comfy_page_uuid'

/** 生成随机 UUID（优先使用浏览器 crypto.randomUUID） */
export function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // 退化实现：基于随机数拼接 v4 形式
  const hex = '0123456789abcdef'
  let out = ''
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += '-'
    } else if (i === 14) {
      out += '4'
    } else if (i === 19) {
      out += hex[(Math.random() * 4 | 0) + 8]
    } else {
      out += hex[Math.floor(Math.random() * 16)]
    }
  }
  return out
}

/** 生成不带短横线的 UUID 十六进制文本（后端 requestUuid 为 BINARY(16)） */
export function randomUuidHex(): string {
  return randomUuid().replace(/-/g, '')
}

/** 获取（或首次生成）本机设备 UUID，持久化在 localStorage */
export function getDeviceUuid(): string {
  let uuid = localStorage.getItem(DEVICE_UUID_KEY)
  if (!uuid) {
    uuid = randomUuid()
    localStorage.setItem(DEVICE_UUID_KEY, uuid)
  }
  return uuid
}

/** 重新生成本机设备 UUID（清理存储或换设备后显式重新绑定） */
export function resetDeviceUuid(): string {
  const uuid = randomUuid()
  localStorage.setItem(DEVICE_UUID_KEY, uuid)
  return uuid
}

/**
 * 获取（或首次生成）当前标签页的执行页 UUID，存储在 sessionStorage
 * 每个标签页互不相同，刷新保留、新标签页重新生成。
 */
export function getPageUuid(): string {
  let uuid = sessionStorage.getItem(PAGE_UUID_KEY)
  if (!uuid) {
    uuid = `p-${randomUuid()}`
    sessionStorage.setItem(PAGE_UUID_KEY, uuid)
  }
  return uuid
}

/** 计算文本的 SHA-256 十六进制摘要 */
export function sha256Hex(text: string): string {
  return sha256(text).toString()
}

/**
 * 计算登录令牌摘要
 *
 * 云端只保存摘要（服务端会对该值再做一次 SHA-256 后落库），
 * 因此这里不会把令牌明文发送到服务端。
 */
export function getLoginTokenDigest(): string {
  const token = getAccessToken() || ''
  return sha256Hex(token)
}

/** 安全解析 JSON，失败时返回兜底值 */
export function parseJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

/** 将任意值序列化为 JSON 文本（对象/数组直接序列化，字符串原样返回） */
export function toJsonText(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

/**
 * 后端时间统一为 UTC 且不带时区标记，这里按 UTC 解释后展示为本地时间
 */
export function formatUtc(text?: string | null, fallback = '-'): string {
  if (!text) return fallback
  const iso = /(z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`
  const d = dayjs(iso)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : fallback
}

/** 把日期选择器等组件的值规范成本地墙钟文本 yyyy-MM-ddTHH:mm:ss */
export function toLocalText(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value.trim().replace(' ', 'T')
  if (value instanceof Date) return dayjs(value).format('YYYY-MM-DDTHH:mm:ss')
  return String(value)
}

/** 把本地墙钟文本/日期转成 UTC 文本（后端 ONCE、INTERVAL 与跳过区间使用） */
export function toUtcText(value: unknown): string {
  const text = toLocalText(value)
  if (!text) return ''
  const d = dayjs(text)
  if (!d.isValid()) return ''
  // 项目未全局注册 dayjs utc 插件，这里用时区偏移换算：UTC = 本地 + getTimezoneOffset()
  return d.add(new Date(text).getTimezoneOffset(), 'minute').format('YYYY-MM-DDTHH:mm:ss')
}

/** 生成本地当前时间的墙钟文本（yyyy-MM-ddTHH:mm:ss） */
export function nowLocalText(offsetMinutes = 0): string {
  return dayjs().add(offsetMinutes, 'minute').format('YYYY-MM-DDTHH:mm:ss')
}
