import type { LabelValueState } from '@/types/global'

/**
 * ComfyUI 模块枚举选项
 *
 * 与后端 top.continew.admin.system.enums.comfy 下各枚举的 value / description / color 保持一致。
 * extra 对应 GiCellTag 支持的标签颜色：primary / success / warning / error / default。
 */

/** 实例状态 */
export const COMFY_INSTANCE_STATUS: LabelValueState[] = [
  { label: '启用', value: 1, extra: 'success' },
  { label: '禁用', value: 2, extra: 'default' },
]

/** 实例执行租约状态 */
export const COMFY_LEASE_STATUS: LabelValueState[] = [
  { label: '在线', value: 1, extra: 'success' },
  { label: '离线', value: 2, extra: 'default' },
]

/** 工作流状态 */
export const COMFY_WORKFLOW_STATUS: LabelValueState[] = [
  { label: '草稿', value: 1, extra: 'default' },
  { label: '就绪', value: 2, extra: 'success' },
]

/** 计划运行方式 */
export const COMFY_RUN_MODE: LabelValueState[] = [
  { label: '单次', value: 'ONCE', extra: 'primary' },
  { label: '每日', value: 'DAILY', extra: 'primary' },
  { label: '每周', value: 'WEEKLY', extra: 'primary' },
  { label: '间隔', value: 'INTERVAL', extra: 'primary' },
]

/** 计划状态 */
export const COMFY_SCHEDULE_STATUS: LabelValueState[] = [
  { label: '启用', value: 1, extra: 'success' },
  { label: '阻塞', value: 2, extra: 'error' },
  { label: '暂停', value: 3, extra: 'warning' },
  { label: '草稿', value: 4, extra: 'default' },
  { label: '已归档', value: 5, extra: 'default' },
]

/** 任务批次状态 */
export const COMFY_BATCH_STATUS: LabelValueState[] = [
  { label: '等待', value: 1, extra: 'default' },
  { label: '部分成功', value: 2, extra: 'warning' },
  { label: '完成', value: 3, extra: 'success' },
  { label: '失败', value: 4, extra: 'error' },
]

/** 任务状态 */
export const COMFY_TASK_STATUS: LabelValueState[] = [
  { label: '等待浏览器', value: 1, extra: 'default' },
  { label: '就绪', value: 2, extra: 'primary' },
  { label: '已领取', value: 3, extra: 'primary' },
  { label: '提交中', value: 4, extra: 'warning' },
  { label: '已提交', value: 5, extra: 'primary' },
  { label: '运行中', value: 6, extra: 'primary' },
  { label: '成功', value: 7, extra: 'success' },
  { label: '失败', value: 8, extra: 'error' },
  { label: '未知', value: 9, extra: 'warning' },
  { label: '对账中', value: 10, extra: 'warning' },
  { label: '取消请求', value: 11, extra: 'warning' },
  { label: '已取消', value: 12, extra: 'default' },
  { label: '阻塞', value: 13, extra: 'error' },
]

/** 任务提交尝试状态 */
export const COMFY_ATTEMPT_STATUS: LabelValueState[] = [
  { label: '发送中', value: 1, extra: 'warning' },
  { label: '成功', value: 2, extra: 'success' },
  { label: '失败', value: 3, extra: 'error' },
  { label: '未知', value: 4, extra: 'warning' },
]

/** 任务提交尝试发送意图 */
export const COMFY_SEND_INTENT: LabelValueState[] = [
  { label: '提交', value: 1, extra: 'primary' },
  { label: '重试', value: 2, extra: 'warning' },
  { label: '对账', value: 3, extra: 'warning' },
  { label: '取消', value: 4, extra: 'warning' },
]

/** 输出收集状态 */
export const COMFY_COLLECT_STATUS: LabelValueState[] = [
  { label: '待收集', value: 1, extra: 'default' },
  { label: '已收集', value: 2, extra: 'success' },
  { label: '收集失败', value: 3, extra: 'error' },
]

/** 输出可用性 */
export const COMFY_AVAILABILITY: LabelValueState[] = [
  { label: '可用', value: 1, extra: 'success' },
  { label: '不可用', value: 2, extra: 'warning' },
  { label: '已删除', value: 3, extra: 'error' },
]

/** 星期（与后端 weeklyDays 的 DayOfWeek 取值一致：1=周一 ... 7=周日） */
export const COMFY_WEEK_DAYS: LabelValueState[] = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 7 },
]

/** 常用 IANA 时区 */
export const COMFY_TIMEZONES: LabelValueState[] = [
  { label: 'Asia/Shanghai（中国标准时间）', value: 'Asia/Shanghai' },
  { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
  { label: 'Asia/Singapore', value: 'Asia/Singapore' },
  { label: 'Europe/London', value: 'Europe/London' },
  { label: 'America/New_York', value: 'America/New_York' },
  { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
  { label: 'UTC', value: 'UTC' },
]

/** 任务状态字典（数值 -> 名称），便于日志与提示展示 */
export const TASK_STATUS_TEXT: Record<number, string> = COMFY_TASK_STATUS.reduce((acc, item) => {
  acc[Number(item.value)] = item.label
  return acc
}, {} as Record<number, string>)

/** 已结束的任务状态（不再轮询） */
export const COMFY_FINAL_TASK_STATUS: number[] = [7, 8, 12]
