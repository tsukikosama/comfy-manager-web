import type * as T from './type'
import http from '@/utils/http'

export type * from './type'

const BASE_URL = '/comfy/instance'

/** @desc 查询实例列表 */
export function listComfyInstance(query: T.ComfyInstancePageQuery) {
  return http.get<PageRes<T.ComfyInstanceResp[]>>(`${BASE_URL}`, query)
}

/** @desc 查询实例详情 */
export function getComfyInstance(id: number) {
  return http.get<T.ComfyInstanceResp>(`${BASE_URL}/${id}`)
}

/** @desc 新增实例 */
export function addComfyInstance(data: T.ComfyInstanceReq) {
  return http.post(`${BASE_URL}`, data)
}

/** @desc 修改实例 */
export function updateComfyInstance(data: T.ComfyInstanceReq, id: number) {
  return http.put(`${BASE_URL}/${id}`, data)
}

/** @desc 删除实例 */
export function deleteComfyInstance(id: number) {
  return http.del(`${BASE_URL}`, { ids: [id] })
}

/** @desc 获取实例执行租约（绑定当前执行页与设备，递增 epoch） */
export function acquireComfyLease(id: number, data: T.ComfyLeaseReq) {
  return http.post<T.ComfyLeaseResp>(`${BASE_URL}/${id}/lease/acquire`, data)
}

/** @desc 续期实例执行租约（同一执行页续期，不递增 epoch） */
export function renewComfyLease(id: number, data: T.ComfyLeaseReq) {
  return http.post<T.ComfyLeaseResp>(`${BASE_URL}/${id}/lease/renew`, data)
}

/** @desc 停止实例执行租约 */
export function stopComfyLease(id: number) {
  return http.post<T.ComfyLeaseResp>(`${BASE_URL}/${id}/lease/stop`)
}

/** @desc 上报实例心跳 */
export function heartbeatComfyInstance(id: number) {
  return http.post(`${BASE_URL}/${id}/heartbeat`)
}
