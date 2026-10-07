import type * as T from './type'
import http from '@/utils/http'

export type * from './type'

const BASE_URL = '/comfy/schedule'

/** @desc 查询计划列表 */
export function listComfySchedule(query: T.ComfySchedulePageQuery) {
  return http.get<PageRes<T.ComfyScheduleResp[]>>(`${BASE_URL}`, query)
}

/** @desc 查询计划详情 */
export function getComfySchedule(id: number) {
  return http.get<T.ComfyScheduleResp>(`${BASE_URL}/${id}`)
}

/** @desc 新增计划 */
export function addComfySchedule(data: T.ComfyScheduleReq) {
  return http.post(`${BASE_URL}`, data)
}

/** @desc 修改计划（存在未物化到期区间时后端拒绝；支持只传需要变更的字段） */
export function updateComfySchedule(data: Partial<T.ComfyScheduleReq>, id: number) {
  return http.put(`${BASE_URL}/${id}`, data)
}

/** @desc 删除计划 */
export function deleteComfySchedule(id: number) {
  return http.del(`${BASE_URL}`, { ids: [id] })
}

/** @desc 预览计划触发时间 */
export function previewComfySchedule(id: number) {
  return http.get<T.ComfySchedulePreviewResp>(`${BASE_URL}/${id}/preview`)
}

/** @desc 跳过未物化到期区间 */
export function skipComfySchedule(id: number, data: T.ComfyScheduleSkipReq) {
  return http.post(`${BASE_URL}/${id}/skip`, data)
}
