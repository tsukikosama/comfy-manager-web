import type * as T from './type'
import http from '@/utils/http'

export type * from './type'

const BASE_URL = '/comfy/taskOutput'

/** @desc 查询任务输出列表 */
export function listComfyTaskOutput(query: T.ComfyTaskOutputPageQuery) {
  return http.get<PageRes<T.ComfyTaskOutputResp[]>>(`${BASE_URL}`, query)
}

/** @desc 查询任务输出详情 */
export function getComfyTaskOutput(id: number) {
  return http.get<T.ComfyTaskOutputResp>(`${BASE_URL}/${id}`)
}
