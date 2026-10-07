import type * as T from './type'
import http from '@/utils/http'

export type * from './type'

const BASE_URL = '/comfy/task'

/** @desc 查询任务列表 */
export function listComfyTask(query: T.ComfyTaskPageQuery) {
  return http.get<PageRes<T.ComfyTaskResp[]>>(`${BASE_URL}`, query)
}

/** @desc 查询任务详情 */
export function getComfyTask(id: number) {
  return http.get<T.ComfyTaskResp>(`${BASE_URL}/${id}`)
}

/** @desc 删除任务 */
export function deleteComfyTask(id: number) {
  return http.del(`${BASE_URL}`, { ids: [id] })
}

/** @desc 领取任务（校验执行页、设备与租约 epoch） */
export function claimComfyTask(id: number, data: T.ComfyClaimReq) {
  return http.post<T.ComfyTaskClaimResp>(`${BASE_URL}/${id}/claim`, data)
}

/** @desc 记录提交意图（云端先记录 SUBMITTING 与实际 prompt） */
export function submitComfyTaskIntent(id: number, data: T.ComfySubmitIntentReq) {
  return http.post(`${BASE_URL}/${id}/submit-intent`, data)
}

/** @desc 回报任务状态（幂等，终态不被旧进度回退） */
export function reportComfyTask(id: number, data: T.ComfyReportReq) {
  return http.post(`${BASE_URL}/${id}/report`, data)
}

/** @desc 对账任务（可信迟到回执） */
export function reconcileComfyTask(id: number, data: T.ComfyReconcileReq) {
  return http.post(`${BASE_URL}/${id}/reconcile`, data)
}

/** @desc 取消任务 */
export function cancelComfyTask(id: number, data: T.ComfyCancelReq) {
  return http.post(`${BASE_URL}/${id}/cancel`, data)
}

/** @desc 重试任务（仅未知状态，需确认可能重复生成） */
export function retryComfyTask(id: number, data: T.ComfyRetryReq) {
  return http.post(`${BASE_URL}/${id}/retry`, data)
}
