<template>
  <GiPageLayout>
    <GiTable
      row-key="id"
      :data="dataList"
      :columns="columns"
      :loading="loading"
      :scroll="{ x: '100%', y: '100%', minWidth: 1100 }"
      :pagination="pagination"
      @refresh="search"
    >
      <template #toolbar-left>
        <a-input-search v-model="queryForm.name" placeholder="搜索工作流名称" allow-clear @search="search" />
        <a-select
          v-model="queryForm.status"
          placeholder="请选择状态"
          :options="COMFY_WORKFLOW_STATUS"
          allow-clear
          style="width: 150px"
          @change="search"
        />
        <a-button @click="reset">
          <template #icon><icon-refresh /></template>
          <template #default>重置</template>
        </a-button>
      </template>
      <template #toolbar-right>
        <a-button v-permission="['comfy:workflow:create']" type="primary" @click="onAdd">
          <template #icon><icon-plus /></template>
          <template #default>新增</template>
        </a-button>
      </template>
      <template #name="{ record }">
        <a-link v-permission="['comfy:workflow:get']" @click="onDetail(record)">{{ record.name }}</a-link>
      </template>
      <template #status="{ record }">
        <GiCellTag :value="record.status" :dict="COMFY_WORKFLOW_STATUS" />
      </template>
      <template #createTime="{ record }">{{ formatUtc(record.createTime) }}</template>
      <template #action="{ record }">
        <a-space>
          <a-link v-permission="['comfy:workflow:get']" title="详情" @click="onDetail(record)">详情</a-link>
          <a-link v-permission="['comfy:workflow:update']" title="修改" @click="onUpdate(record)">修改</a-link>
          <a-link v-permission="['comfy:workflow:delete']" status="danger" title="删除" @click="onDelete(record)">
            删除
          </a-link>
        </a-space>
      </template>
    </GiTable>

    <AddModal ref="AddModalRef" @save-success="search" />
    <DetailDrawer ref="DetailDrawerRef" />
  </GiPageLayout>
</template>

<script setup lang="ts">
import type { TableInstance } from '@arco-design/web-vue'
import AddModal from './AddModal.vue'
import DetailDrawer from './DetailDrawer.vue'
import { type ComfyWorkflowPageQuery, type ComfyWorkflowResp, deleteComfyWorkflow, listComfyWorkflow } from '@/apis/comfy'
import { COMFY_WORKFLOW_STATUS } from '@/constant/comfy'
import { useTable } from '@/hooks'
import { formatUtc } from '@/utils/comfy'
import { isMobile } from '@/utils'
import has from '@/utils/has'

defineOptions({ name: 'ComfyWorkflow' })

const queryForm = reactive<ComfyWorkflowPageQuery>({})

const {
  tableData: dataList,
  loading,
  pagination,
  search,
  handleDelete,
} = useTable((page) => listComfyWorkflow({ ...queryForm, ...page }), { immediate: false })

const columns: TableInstance['columns'] = [
  {
    title: '序号',
    width: 66,
    align: 'center',
    render: ({ rowIndex }) => h('span', {}, rowIndex + 1 + (pagination.current - 1) * pagination.pageSize),
  },
  { title: '工作流名称', dataIndex: 'name', slotName: 'name', minWidth: 160, ellipsis: true, tooltip: true },
  { title: '描述', dataIndex: 'description', minWidth: 180, ellipsis: true, tooltip: true },
  { title: '状态', dataIndex: 'status', slotName: 'status', align: 'center', width: 90 },
  { title: '配置版本', dataIndex: 'configRevision', align: 'center', width: 100 },
  { title: '创建时间', dataIndex: 'createTime', slotName: 'createTime', width: 180 },
  {
    title: '操作',
    slotName: 'action',
    width: 170,
    align: 'center',
    fixed: !isMobile() ? 'right' : undefined,
    show: has.hasPermOr(['comfy:workflow:get', 'comfy:workflow:update', 'comfy:workflow:delete']),
  },
]

const reset = () => {
  queryForm.name = undefined
  queryForm.status = undefined
  search()
}

const AddModalRef = ref<InstanceType<typeof AddModal>>()
const DetailDrawerRef = ref<InstanceType<typeof DetailDrawer>>()

const onAdd = () => AddModalRef.value?.onAdd()
const onUpdate = (record: ComfyWorkflowResp) => AddModalRef.value?.onUpdate(record)
const onDetail = (record: ComfyWorkflowResp) => DetailDrawerRef.value?.onOpen(record.id)
const onDelete = (record: ComfyWorkflowResp) => {
  handleDelete(() => deleteComfyWorkflow(record.id), {
    title: '确认删除该工作流？',
    content: '已有计划仍保留此工作流的执行快照，不会受影响。',
  })
}

onMounted(() => {
  search()
})
</script>

<style scoped lang="scss"></style>
