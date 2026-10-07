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
        <a-input-search v-model="queryForm.name" placeholder="搜索计划名称" allow-clear @search="search" />
        <a-select
          v-model="queryForm.status"
          placeholder="请选择状态"
          :options="COMFY_SCHEDULE_STATUS"
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
        <a-button v-permission="['comfy:schedule:create']" type="primary" @click="onAdd">
          <template #icon><icon-plus /></template>
          <template #default>新增</template>
        </a-button>
      </template>
      <template #name="{ record }">
        <a-link v-permission="['comfy:schedule:get']" @click="onDetail(record)">{{ record.name }}</a-link>
        <a-tag v-if="record.hasUnmaterialized" color="orange" size="small" style="margin-left: 6px">有积压</a-tag>
      </template>
      <template #runMode="{ record }">
        <GiCellTag :value="record.runMode" :dict="COMFY_RUN_MODE" />
      </template>
      <template #status="{ record }">
        <GiCellTag :value="record.status" :dict="COMFY_SCHEDULE_STATUS" />
      </template>
      <template #nextRunAtUtc="{ record }">{{ formatUtc(record.nextRunAtUtc, '无') }}</template>
      <template #timezone="{ record }">{{ record.timezone }}</template>
      <template #createTime="{ record }">{{ formatUtc(record.createTime) }}</template>
      <template #action="{ record }">
        <a-space>
          <a-link v-permission="['comfy:schedule:preview']" title="触发预览" @click="onPreview(record)">预览</a-link>
          <a-link
            v-if="record.status === 1"
            v-permission="['comfy:schedule:update']"
            title="暂停"
            @click="onToggleStatus(record, 3)"
          >
            暂停
          </a-link>
          <a-link
            v-else-if="record.status === 3 || record.status === 4"
            v-permission="['comfy:schedule:update']"
            title="启用"
            @click="onToggleStatus(record, 1)"
          >
            启用
          </a-link>
          <a-link v-permission="['comfy:schedule:update']" title="修改" @click="onUpdate(record)">修改</a-link>
          <a-link v-permission="['comfy:schedule:delete']" status="danger" title="删除" @click="onDelete(record)">
            删除
          </a-link>
        </a-space>
      </template>
    </GiTable>

    <AddModal ref="AddModalRef" @save-success="search" />
    <DetailDrawer ref="DetailDrawerRef" />
    <PreviewDrawer ref="PreviewDrawerRef" />
  </GiPageLayout>
</template>

<script setup lang="ts">
import type { TableInstance } from '@arco-design/web-vue'
import { Message } from '@arco-design/web-vue'
import AddModal from './AddModal.vue'
import DetailDrawer from './DetailDrawer.vue'
import PreviewDrawer from './PreviewDrawer.vue'
import {
  type ComfySchedulePageQuery,
  type ComfyScheduleResp,
  type ScheduleStatus,
  deleteComfySchedule,
  listComfySchedule,
  updateComfySchedule,
} from '@/apis/comfy'
import { COMFY_RUN_MODE, COMFY_SCHEDULE_STATUS } from '@/constant/comfy'
import { useTable } from '@/hooks'
import { formatUtc } from '@/utils/comfy'
import { isMobile } from '@/utils'
import has from '@/utils/has'

defineOptions({ name: 'ComfySchedule' })

const queryForm = reactive<ComfySchedulePageQuery>({})

const {
  tableData: dataList,
  loading,
  pagination,
  search,
  handleDelete,
} = useTable((page) => listComfySchedule({ ...queryForm, ...page }), { immediate: false })

const columns: TableInstance['columns'] = [
  {
    title: '序号',
    width: 66,
    align: 'center',
    render: ({ rowIndex }) => h('span', {}, rowIndex + 1 + (pagination.current - 1) * pagination.pageSize),
  },
  { title: '计划名称', dataIndex: 'name', slotName: 'name', minWidth: 160, ellipsis: true, tooltip: true },
  { title: '运行方式', dataIndex: 'runMode', slotName: 'runMode', align: 'center', width: 100 },
  { title: '时区', dataIndex: 'timezone', slotName: 'timezone', width: 160 },
  { title: '目标实例', dataIndex: 'instanceId', align: 'center', width: 100 },
  { title: '工作流', dataIndex: 'workflowId', align: 'center', width: 100 },
  { title: '每次任务数', dataIndex: 'taskCountPerRun', align: 'center', width: 100 },
  { title: '下次触发', dataIndex: 'nextRunAtUtc', slotName: 'nextRunAtUtc', width: 180 },
  { title: '状态', dataIndex: 'status', slotName: 'status', align: 'center', width: 100 },
  { title: '创建时间', dataIndex: 'createTime', slotName: 'createTime', width: 180, show: false },
  {
    title: '操作',
    slotName: 'action',
    width: 240,
    align: 'center',
    fixed: !isMobile() ? 'right' : undefined,
    show: has.hasPermOr(['comfy:schedule:preview', 'comfy:schedule:update', 'comfy:schedule:delete']),
  },
]

const reset = () => {
  queryForm.name = undefined
  queryForm.status = undefined
  search()
}

const AddModalRef = ref<InstanceType<typeof AddModal>>()
const DetailDrawerRef = ref<InstanceType<typeof DetailDrawer>>()
const PreviewDrawerRef = ref<InstanceType<typeof PreviewDrawer>>()

const onAdd = () => AddModalRef.value?.onAdd()
const onUpdate = (record: ComfyScheduleResp) => AddModalRef.value?.onUpdate(record)
const onDetail = (record: ComfyScheduleResp) => DetailDrawerRef.value?.onOpen(record.id)
const onPreview = (record: ComfyScheduleResp) => PreviewDrawerRef.value?.onOpen(record.id)

const onDelete = (record: ComfyScheduleResp) => {
  handleDelete(() => deleteComfySchedule(record.id), {
    title: '确认删除该计划？',
    content: '已创建的批次与任务不受影响，但不会再产生新的触发。',
  })
}

// 暂停 / 启用（存在未物化区间时后端会拒绝）
const onToggleStatus = async (record: ComfyScheduleResp, status: ScheduleStatus) => {
  try {
    await updateComfySchedule({ status }, record.id)
    Message.success(status === 3 ? '已暂停' : '已启用')
    search()
  } catch (error) {
    Message.error((error as Error).message || '操作失败')
  }
}

onMounted(() => {
  search()
})
</script>

<style scoped lang="scss"></style>
