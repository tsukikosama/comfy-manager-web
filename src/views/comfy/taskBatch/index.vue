<template>
  <GiPageLayout>
    <GiTable
      row-key="id"
      :data="dataList"
      :columns="columns"
      :loading="loading"
      :scroll="{ x: '100%', y: '100%', minWidth: 1300 }"
      :pagination="pagination"
      @refresh="search"
    >
      <template #toolbar-left>
        <a-input-number v-model="queryForm.scheduleId" placeholder="按计划ID筛选" allow-clear @change="search" />
        <a-select
          v-model="queryForm.status"
          placeholder="请选择状态"
          :options="COMFY_BATCH_STATUS"
          allow-clear
          style="width: 150px"
          @change="search"
        />
        <a-button @click="reset">
          <template #icon><icon-refresh /></template>
          <template #default>重置</template>
        </a-button>
      </template>
      <template #scheduledAtUtc="{ record }">{{ formatUtc(record.scheduledAtUtc) }}</template>
      <template #status="{ record }">
        <GiCellTag :value="record.status" :dict="COMFY_BATCH_STATUS" />
      </template>
      <template #scheduleId="{ record }">
        <span>{{ record.scheduleId || '手动批次' }}</span>
      </template>
      <template #createTime="{ record }">{{ formatUtc(record.createTime) }}</template>
      <template #action="{ record }">
        <a-space>
          <a-link v-permission="['comfy:taskBatch:get']" title="详情" @click="onDetail(record)">详情</a-link>
          <a-link title="查看任务" @click="onViewTasks(record)">查看任务</a-link>
          <a-link v-permission="['comfy:taskBatch:delete']" status="danger" title="删除" @click="onDelete(record)">
            删除
          </a-link>
        </a-space>
      </template>
    </GiTable>

    <DetailDrawer ref="DetailDrawerRef" />
  </GiPageLayout>
</template>

<script setup lang="ts">
import type { TableInstance } from '@arco-design/web-vue'
import { useRouter } from 'vue-router'
import DetailDrawer from './DetailDrawer.vue'
import { type ComfyTaskBatchPageQuery, type ComfyTaskBatchResp, deleteComfyTaskBatch, listComfyTaskBatch } from '@/apis/comfy'
import { COMFY_BATCH_STATUS } from '@/constant/comfy'
import { useTable } from '@/hooks'
import { formatUtc } from '@/utils/comfy'
import { isMobile } from '@/utils'
import has from '@/utils/has'

defineOptions({ name: 'ComfyTaskBatch' })

const router = useRouter()
const queryForm = reactive<ComfyTaskBatchPageQuery>({})

const {
  tableData: dataList,
  loading,
  pagination,
  search,
  handleDelete,
} = useTable((page) => listComfyTaskBatch({ ...queryForm, ...page }), { immediate: false })

const columns: TableInstance['columns'] = [
  {
    title: '序号',
    width: 66,
    align: 'center',
    render: ({ rowIndex }) => h('span', {}, rowIndex + 1 + (pagination.current - 1) * pagination.pageSize),
  },
  { title: '批次ID', dataIndex: 'id', width: 90 },
  { title: '来源计划', dataIndex: 'scheduleId', slotName: 'scheduleId', width: 110 },
  { title: '目标实例', dataIndex: 'instanceId', width: 100 },
  { title: '触发时刻', dataIndex: 'scheduledAtUtc', slotName: 'scheduledAtUtc', width: 180 },
  { title: '任务数', dataIndex: 'taskCount', align: 'center', width: 90 },
  { title: '状态', dataIndex: 'status', slotName: 'status', align: 'center', width: 110 },
  { title: '请求键', dataIndex: 'requestKey', minWidth: 180, ellipsis: true, tooltip: true, show: false },
  { title: '创建时间', dataIndex: 'createTime', slotName: 'createTime', width: 180 },
  {
    title: '操作',
    slotName: 'action',
    width: 180,
    align: 'center',
    fixed: !isMobile() ? 'right' : undefined,
    show: has.hasPermOr(['comfy:taskBatch:get', 'comfy:taskBatch:delete']),
  },
]

const reset = () => {
  queryForm.scheduleId = undefined
  queryForm.status = undefined
  search()
}

const DetailDrawerRef = ref<InstanceType<typeof DetailDrawer>>()
const onDetail = (record: ComfyTaskBatchResp) => DetailDrawerRef.value?.onOpen(record.id)

// 跳转到任务页并按批次过滤
const onViewTasks = (record: ComfyTaskBatchResp) => {
  router.push({ path: '/comfy/task', query: { taskBatchId: String(record.id) } })
}

const onDelete = (record: ComfyTaskBatchResp) => {
  handleDelete(() => deleteComfyTaskBatch(record.id), {
    title: '确认删除该批次？',
    content: '仅删除云端批次记录，不会影响 ComfyUI 已生成的文件。',
  })
}

onMounted(() => {
  search()
})
</script>

<style scoped lang="scss"></style>
