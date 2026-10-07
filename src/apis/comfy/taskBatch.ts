import type * as T from './type'
import http from '@/utils/http'

export type * from './type'

const BASE_URL = '/comfy/taskBatch'

/** @desc 查询任务批次列表（批次由计划扫描物化产生，不支持新增与修改） */
export function listComfyTaskBatch(query: T.ComfyTaskBatchPageQuery) {
  return http.get<PageRes<T.ComfyTaskBatchResp[]>>(`${BASE_URL}`, query)
}

/** @desc 查询任务批次详情 */
export function getComfyTaskBatch(id: number) {
  return http.get<T.ComfyTaskBatchResp>(`${BASE_URL}/${id}`)
}

/** @desc 删除任务批次 */
export function deleteComfyTaskBatch(id: number) {
  return http.del(`${BASE_URL}`, { ids: [id] })
}
