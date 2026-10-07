<template>
  <GiPageLayout>
    <GiTable
      row-key="id"
      :data="dataList"
      :columns="columns"
      :loading="loading"
      :scroll="{ x: '100%', y: '100%', minWidth: 1200 }"
      :pagination="pagination"
      @refresh="search"
    >
      <template #toolbar-left>
        <a-input-search v-model="queryForm.name" placeholder="搜索实例名称" allow-clear @search="search" />
        <a-select
          v-model="queryForm.leaseStatus"
          placeholder="请选择租约状态"
          :options="COMFY_LEASE_STATUS"
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
        <a-button v-permission="['comfy:instance:create']" type="primary" @click="onAdd">
          <template #icon><icon-plus /></template>
          <template #default>新增</template>
        </a-button>
        <a-button @click="ExecutorDrawerRef?.open()">
          <template #icon><icon-thunderbolt /></template>
          <template #default>执行引擎</template>
        </a-button>
      </template>
      <template #name="{ record }">
        <a-link v-permission="['comfy:instance:get']" @click="onDetail(record)">{{ record.name }}</a-link>
      </template>
      <template #endpointUrl="{ record }">
        <a-space>
          <span>{{ record.endpointUrl }}</span>
          <a-tooltip content="检测本机/局域网 ComfyUI 连通性">
            <a-button size="mini" :loading="checkingId === record.id" @click="onCheck(record)">
              <template #icon><icon-wifi /></template>
            </a-button>
          </a-tooltip>
        </a-space>
      </template>
      <template #leaseStatus="{ record }">
        <GiCellTag :value="record.leaseStatus" :dict="COMFY_LEASE_STATUS" />
      </template>
      <template #status="{ record }">
        <GiCellTag :value="record.status" :dict="COMFY_INSTANCE_STATUS" />
      </template>
      <template #lastHeartbeatAt="{ record }">{{ formatUtc(record.lastHeartbeatAt) }}</template>
      <template #action="{ record }">
        <a-space>
          <a-link
            v-if="executorState.instanceId !== record.id || !executorState.active"
            v-permission="['comfy:instance:lease']"
            title="启用本页执行"
            @click="onStartExecute(record)"
          >
            启用本页执行
          </a-link>
          <a-link v-else v-permission="['comfy:instance:lease']" status="danger" title="停止执行" @click="onStopExecute">
            停止执行
          </a-link>
          <a-link v-permission="['comfy:instance:update']" title="修改" @click="onUpdate(record)">修改</a-link>
          <a-link v-permission="['comfy:instance:delete']" status="danger" title="删除" @click="onDelete(record)">
            删除
          </a-link>
        </a-space>
      </template>
    </GiTable>

    <AddModal ref="AddModalRef" @save-success="search" />
    <DetailDrawer ref="DetailDrawerRef" />
    <ExecutorDrawer ref="ExecutorDrawerRef" />
  </GiPageLayout>
</template>

<script setup lang="ts">
import type { TableInstance } from '@arco-design/web-vue'
import { Message } from '@arco-design/web-vue'
import ExecutorDrawer from '../components/ExecutorDrawer.vue'
import AddModal from './AddModal.vue'
import DetailDrawer from './DetailDrawer.vue'
import { type ComfyInstancePageQuery, type ComfyInstanceResp, deleteComfyInstance, listComfyInstance } from '@/apis/comfy'
import { COMFY_INSTANCE_STATUS, COMFY_LEASE_STATUS } from '@/constant/comfy'
import { useTable } from '@/hooks'
import { useComfyExecutor } from '@/features/comfy/executor'
import { getSystemStats } from '@/features/comfy/client'
import { formatUtc } from '@/utils/comfy'
import { isMobile } from '@/utils'
import has from '@/utils/has'

defineOptions({ name: 'ComfyInstance' })

const queryForm = reactive<ComfyInstancePageQuery>({})

const {
  tableData: dataList,
  loading,
  pagination,
  search,
  handleDelete,
} = useTable((page) => listComfyInstance({ ...queryForm, ...page }), { immediate: false })

const { state: executorState, start, stop, pushLog } = useComfyExecutor()

const columns: TableInstance['columns'] = [
  {
    title: '序号',
    width: 66,
    align: 'center',
    render: ({ rowIndex }) => h('span', {}, rowIndex + 1 + (pagination.current - 1) * pagination.pageSize),
  },
  { title: '实例名称', dataIndex: 'name', slotName: 'name', minWidth: 130, ellipsis: true, tooltip: true },
  { title: 'ComfyUI 地址', dataIndex: 'endpointUrl', slotName: 'endpointUrl', minWidth: 240, ellipsis: true, tooltip: true },
  { title: '设备UUID', dataIndex: 'deviceUuid', minWidth: 180, ellipsis: true, tooltip: true, show: false },
  { title: '执行租约', dataIndex: 'leaseStatus', slotName: 'leaseStatus', align: 'center', width: 100 },
  { title: '状态', dataIndex: 'status', slotName: 'status', align: 'center', width: 90 },
  { title: '最后心跳', dataIndex: 'lastHeartbeatAt', slotName: 'lastHeartbeatAt', width: 180 },
  {
    title: '操作',
    slotName: 'action',
    width: 220,
    align: 'center',
    fixed: !isMobile() ? 'right' : undefined,
    show: has.hasPermOr(['comfy:instance:lease', 'comfy:instance:update', 'comfy:instance:delete']),
  },
]

// 重置
const reset = () => {
  queryForm.name = undefined
  queryForm.leaseStatus = undefined
  search()
}

const AddModalRef = ref<InstanceType<typeof AddModal>>()
const DetailDrawerRef = ref<InstanceType<typeof DetailDrawer>>()
const ExecutorDrawerRef = ref<InstanceType<typeof ExecutorDrawer>>()

// 新增
const onAdd = () => {
  AddModalRef.value?.onAdd()
}

// 修改
const onUpdate = (record: ComfyInstanceResp) => {
  AddModalRef.value?.onUpdate(record)
}

// 详情
const onDetail = (record: ComfyInstanceResp) => {
  DetailDrawerRef.value?.onOpen(record.id)
}

// 删除
const onDelete = (record: ComfyInstanceResp) => {
  handleDelete(() => deleteComfyInstance(record.id), { title: '确认删除该实例？', content: '删除后该实例的固定目标快照仍保留在已有任务上。' })
}

// 连通性检测
const checkingId = ref<number>()
const onCheck = async (record: ComfyInstanceResp) => {
  checkingId.value = record.id
  try {
    const stats = await getSystemStats(record.endpointUrl, { timeout: 8000 })
    const device = stats?.devices?.[0]
    const vram = device?.vram_total ? `，显存 ${Math.round((device.vram_total || 0) / 1024 / 1024 / 1024)}GB` : ''
    Message.success(`已连通：${device?.name || '未知设备'}${vram}`)
  } catch (error) {
    Message.error((error as Error).message || '检测失败')
  } finally {
    checkingId.value = undefined
  }
}

// 启用本页执行
const onStartExecute = async (record: ComfyInstanceResp) => {
  try {
    await start({ id: record.id, name: record.name, endpointUrl: record.endpointUrl })
    Message.success('已启用本页执行，开始领取任务')
  } catch (error) {
    pushLog('error', `启用本页执行失败：${(error as Error).message}`)
  }
}

// 停止执行
const onStopExecute = async () => {
  await stop()
  Message.success('已停止本页执行')
}

// 关闭页面前释放执行权，避免租约残留
const onBeforeUnload = () => {
  if (executorState.active) {
    void stop()
  }
}
onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload)
  search()
})
onUnmounted(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
})
</script>

<style scoped lang="scss"></style>
