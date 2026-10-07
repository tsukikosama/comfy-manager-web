import type * as T from './type'
import http from '@/utils/http'

export type * from './type'

const BASE_URL = '/comfy/workflow'

/** @desc 查询工作流列表 */
export function listComfyWorkflow(query: T.ComfyWorkflowPageQuery) {
  return http.get<PageRes<T.ComfyWorkflowResp[]>>(`${BASE_URL}`, query)
}

/** @desc 查询工作流详情 */
export function getComfyWorkflow(id: number) {
  return http.get<T.ComfyWorkflowResp>(`${BASE_URL}/${id}`)
}

/** @desc 新增工作流 */
export function addComfyWorkflow(data: T.ComfyWorkflowReq) {
  return http.post(`${BASE_URL}`, data)
}

/** @desc 修改工作流 */
export function updateComfyWorkflow(data: T.ComfyWorkflowReq, id: number) {
  return http.put(`${BASE_URL}/${id}`, data)
}

/** @desc 删除工作流 */
export function deleteComfyWorkflow(id: number) {
  return http.del(`${BASE_URL}`, { ids: [id] })
}
