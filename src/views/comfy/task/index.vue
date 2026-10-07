<template>
  <GiPageLayout>
    <GiTable
      row-key="id"
      :data="dataList"
      :columns="columns"
      :loading="loading"
      :scroll="{ x: '100%', y: '100%', minWidth: 1400 }"
      :pagination="pagination"
      @refresh="search"
    >
      <template #toolbar-left>
        <a-select
          v-model="queryForm.status"
          placeholder="请选择任务状态"
          :options="COMFY_TASK_STATUS"
          allow-clear
          style="width: 160px"
          @change="search"
        />
        <a-input-number v-model="queryForm.taskBatchId" placeholder="按批次ID筛选" allow-clear @change="search" />
        <a-input-number v-model="queryForm.scheduleId" placeholder="按计划ID筛选" allow-clear @change="search" />
        <a-button @click="reset">
          <template #icon><icon-refresh /></template>
          <template #default>重置</template>
        </a-button>
      </template>
      <template #toolbar-right>
        <a-space>
          <a-switch v-model="autoRefresh" size="medium">
            <template #checked>自动刷新</template>
            <template #unchecked>手动刷新</template>
          </a-switch>
          <a-button @click="ExecutorDrawerRef?.open()">
            <template #icon><icon-thunderbolt /></template>
            <template #default>执行引擎</template>
          </a-button>
        </a-space>
      </template>
      <template #id="{ record }">
        <a-link v-permission="['comfy:task:get']" @click="onDetail(record)">#{{ record.id }}</a-link>
      </template>
      <template #status="{ record }">
        <GiCellTag :value="record.status" :dict="COMFY_TASK_STATUS" />
      </template>
      <template #scheduledAtUtc="{ record }">{{ formatUtc(record.scheduledAtUtc) }}</template>
      <template #endpointUrl="{ record }">{{ record.endpointUrl }}</template>
      <template #createTime="{ record }">{{ formatUtc(record.createTime) }}</template>
      <template #action="{ record }">
        <a-space>
          <a-link v-permission="['comfy:task:get']" title="详情" @click="onDetail(record)">详情</a-link>
          <a-popconfirm
            v-if="record.status === 9"
            content="UNKNOWN 任务重试可能产生重复生成，是否继续？"
            type="warning"
            @ok="onRetry(record)"
          >
            <a-link v-permission="['comfy:task:retry']" title="重试">重试</a-link>
          </a-popconfirm>
          <a-popconfirm
            v-if="![7, 8, 12].includes(record.status)"
            content="是否确定取消该任务？已提交的任务只能记录取消请求。"
            type="warning"
            @ok="onCancel(record)"
          >
            <a-link v-permission="['comfy:task:cancel']" title="取消">取消</a-link>
          </a-popconfirm>
          <a-link v-permission="['comfy:task:delete']" status="danger" title="删除" @click="onDelete(record)">
            删除
          </a-link>
        </a-space>
      </template>
    </GiTable>

    <DetailDrawer ref="DetailDrawerRef" @save-success="search" />
    <ExecutorDrawer ref="ExecutorDrawerRef" />
  </GiPageLayout>
</template>

<script setup lang="ts">
import type { TableInstance } from '@arco-design/web-vue'
import { Message } from '@arco-design/web-vue'
import { useRoute } from 'vue-router'
import ExecutorDrawer from '../components/ExecutorDrawer.vue'
import DetailDrawer from './DetailDrawer.vue'
import { type ComfyTaskPageQuery, type ComfyTaskResp, cancelComfyTask, deleteComfyTask, listComfyTask, retryComfyTask } from '@/apis/comfy'
import { COMFY_TASK_STATUS } from '@/constant/comfy'
import { useTable } from '@/hooks'
import { formatUtc, randomUuidHex } from '@/utils/comfy'
import { isMobile } from '@/utils'
import has from '@/utils/has'

defineOptions({ name: 'ComfyTask' })

const route = useRoute()

const queryForm = reactive<ComfyTaskPageQuery>({})

const {
  tableData: dataList,
  loading,
  pagination,
  search,
  handleDelete,
} = useTable((page) => listComfyTask({ ...queryForm, ...page }), { immediate: false })

const columns: TableInstance['columns'] = [
  {
    title: '序号',
    width: 66,
    align: 'center',
    render: ({ rowIndex }) => h('span', {}, rowIndex + 1 + (pagination.current - 1) * pagination.pageSize),
  },
  { title: '任务ID', dataIndex: 'id', slotName: 'id', width: 100 },
  { title: '批次', dataIndex: 'taskBatchId', width: 90 },
  { title: '项序', dataIndex: 'itemIndex', align: 'center', width: 70 },
  { title: '计划', dataIndex: 'scheduleId', width: 90, show: false },
  { title: '计划触发时间', dataIndex: 'scheduledAtUtc', slotName: 'scheduledAtUtc', width: 180 },
  { title: '目标地址（快照）', dataIndex: 'endpointUrl', slotName: 'endpointUrl', minWidth: 220, ellipsis: true, tooltip: true },
  { title: '状态', dataIndex: 'status', slotName: 'status', align: 'center', width: 110 },
  { title: '尝试', dataIndex: 'currentAttemptNo', align: 'center', width: 80 },
  { title: 'promptId', dataIndex: 'promptId', minWidth: 180, ellipsis: true, tooltip: true, show: false },
  { title: '创建时间', dataIndex: 'createTime', slotName: 'createTime', width: 180 },
  {
    title: '操作',
    slotName: 'action',
    width: 200,
    align: 'center',
    fixed: !isMobile() ? 'right' : undefined,
    show: has.hasPermOr(['comfy:task:get', 'comfy:task:retry', 'comfy:task:cancel', 'comfy:task:delete']),
  },
]

const reset = () => {
  queryForm.status = undefined
  queryForm.taskBatchId = undefined
  queryForm.scheduleId = undefined
  search()
}

const DetailDrawerRef = ref<InstanceType<typeof DetailDrawer>>()
const ExecutorDrawerRef = ref<InstanceType<typeof ExecutorDrawer>>()

const onDetail = (record: ComfyTaskResp) => DetailDrawerRef.value?.onOpen(record.id)

const onCancel = async (record: ComfyTaskResp) => {
  try {
    await cancelComfyTask(record.id, { reason: '用户在任务列表取消' })
    Message.success('已提交取消')
    search()
  } catch (error) {
    Message.error((error as Error).message || '取消失败')
  }
}

const onRetry = async (record: ComfyTaskResp) => {
  try {
    await retryComfyTask(record.id, { requestUuid: randomUuidHex() })
    Message.success('已创建新的提交尝试，请在执行引擎中继续处理')
    search()
  } catch (error) {
    Message.error((error as Error).message || '重试失败')
  }
}

const onDelete = (record: ComfyTaskResp) => {
  handleDelete(() => deleteComfyTask(record.id), {
    title: '确认删除该任务？',
    content: '仅删除云端任务记录，不会影响 ComfyUI 已生成的文件。',
  })
}

// 自动刷新任务状态
const autoRefresh = ref(false)
let refreshTimer: ReturnType<typeof setInterval> | undefined
watch(autoRefresh, (value) => {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = undefined
  if (value) {
    refreshTimer = setInterval(() => search(), 5000)
  }
})

onMounted(() => {
  // 支持从批次页跳转过来按批次过滤
  const batchId = route.query.taskBatchId
  if (batchId) queryForm.taskBatchId = Number(batchId)
  search()
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped lang="scss"></style>
