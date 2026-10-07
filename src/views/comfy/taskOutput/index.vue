<template>
  <GiPageLayout>
    <a-tabs v-model:active-key="activeTab" class="comfy-tabs">
      <a-tab-pane key="cloud" title="云端记录">
        <GiTable
          row-key="id"
          :data="dataList"
          :columns="cloudColumns"
          :loading="loading"
          :scroll="{ x: '100%', y: '100%', minWidth: 1300 }"
          :pagination="pagination"
          @refresh="search"
        >
          <template #toolbar-left>
            <a-input-number v-model="queryForm.taskId" placeholder="按任务ID筛选" allow-clear @change="search" />
            <a-input-number v-model="queryForm.taskBatchId" placeholder="按批次ID筛选" allow-clear @change="search" />
            <a-button @click="reset">
              <template #icon><icon-refresh /></template>
              <template #default>重置</template>
            </a-button>
          </template>
          <template #collectStatus="{ record }">
            <GiCellTag :value="record.collectStatus" :dict="COMFY_COLLECT_STATUS" />
          </template>
          <template #availability="{ record }">
            <GiCellTag :value="record.availability" :dict="COMFY_AVAILABILITY" />
          </template>
          <template #createTime="{ record }">{{ formatUtc(record.createTime) }}</template>
          <template #action="{ record }">
            <a-space>
              <a-button size="mini" @click="onPreviewCloud(record)">预览</a-button>
              <a-button size="mini" @click="onDownloadCloud(record)">下载</a-button>
            </a-space>
          </template>
        </GiTable>
      </a-tab-pane>

      <a-tab-pane key="local" :title="`本地记录（${localOutputs.length}）`">
        <a-alert type="normal" style="margin-bottom: 12px">
          后端当前未提供输出写入接口，这里展示浏览器在本机收集到的输出引用（任务成功后从 ComfyUI 历史收集，保存在本地）。
          文件仍由 ComfyUI 按原输出配置保存，预览与下载都是浏览器直连 ComfyUI /view，不经过云端。
        </a-alert>
        <GiTable
          row-key="key"
          :data="localOutputs"
          :columns="localColumns"
          :pagination="false"
          :scroll="{ x: '100%', y: '100%', minWidth: 1200 }"
        >
          <template #toolbar-right>
            <a-button status="danger" @click="onClearLocal">
              <template #icon><icon-delete /></template>
              <template #default>清空本地记录</template>
            </a-button>
          </template>
          <template #file="{ record }">
            <span>{{ record.subfolder ? `${record.subfolder}/` : '' }}{{ record.filename }}</span>
          </template>
          <template #createdAt="{ record }">{{ formatUtc(record.createdAt) }}</template>
          <template #localAction="{ record }">
            <a-space>
              <a-button size="mini" @click="onPreviewLocal(record)">预览</a-button>
              <a-button size="mini" @click="onDownloadLocal(record)">下载</a-button>
            </a-space>
          </template>
        </GiTable>
      </a-tab-pane>
    </a-tabs>

    <a-modal v-model:visible="previewVisible" title="输出预览" :width="720" :footer="false">
      <div class="preview-wrapper">
        <img v-if="previewUrl" :src="previewUrl" alt="预览" />
        <a-empty v-else description="无法加载预览" />
      </div>
    </a-modal>
  </GiPageLayout>
</template>

<script setup lang="ts">
import type { TableInstance } from '@arco-design/web-vue'
import { Message, Modal } from '@arco-design/web-vue'
import {
  type ComfyTaskOutputPageQuery,
  type ComfyTaskOutputResp,
  listComfyTaskOutput,
} from '@/apis/comfy'
import { COMFY_AVAILABILITY, COMFY_COLLECT_STATUS } from '@/constant/comfy'
import { useTable } from '@/hooks'
import { type ComfyLocalOutput, useComfyStore } from '@/stores/modules/comfy'
import { buildViewUrl, downloadOutput } from '@/features/comfy/client'
import { formatUtc } from '@/utils/comfy'
import { isMobile } from '@/utils'

defineOptions({ name: 'ComfyTaskOutput' })

const comfyStore = useComfyStore()
const activeTab = ref('cloud')

const queryForm = reactive<ComfyTaskOutputPageQuery>({})

const {
  tableData: dataList,
  loading,
  pagination,
  search,
} = useTable((page) => listComfyTaskOutput({ ...queryForm, ...page }), { immediate: false })

const cloudColumns: TableInstance['columns'] = [
  {
    title: '序号',
    width: 66,
    align: 'center',
    render: ({ rowIndex }) => h('span', {}, rowIndex + 1 + (pagination.current - 1) * pagination.pageSize),
  },
  { title: '输出ID', dataIndex: 'id', width: 90 },
  { title: '任务ID', dataIndex: 'taskId', width: 90 },
  { title: '文件名', dataIndex: 'filename', minWidth: 200, ellipsis: true, tooltip: true },
  { title: '子目录', dataIndex: 'subfolder', width: 110 },
  { title: '类型', dataIndex: 'type', width: 90 },
  { title: '产出节点', dataIndex: 'nodeId', width: 100 },
  { title: '收集状态', dataIndex: 'collectStatus', slotName: 'collectStatus', align: 'center', width: 110 },
  { title: '可用性', dataIndex: 'availability', slotName: 'availability', align: 'center', width: 100 },
  { title: '创建时间', dataIndex: 'createTime', slotName: 'createTime', width: 180 },
  {
    title: '操作',
    slotName: 'action',
    width: 140,
    align: 'center',
    fixed: !isMobile() ? 'right' : undefined,
  },
]

const localColumns: TableInstance['columns'] = [
  { title: '任务ID', dataIndex: 'taskId', width: 90 },
  { title: '文件', slotName: 'file', minWidth: 240, ellipsis: true, tooltip: true },
  { title: '类型', dataIndex: 'type', width: 90 },
  { title: '产出节点', dataIndex: 'nodeId', width: 100 },
  { title: '原目标地址', dataIndex: 'endpointUrl', minWidth: 220, ellipsis: true, tooltip: true },
  { title: '收集时间', dataIndex: 'createdAt', slotName: 'createdAt', width: 180 },
  {
    title: '操作',
    slotName: 'localAction',
    width: 140,
    align: 'center',
    fixed: !isMobile() ? 'right' : undefined,
  },
]

const localOutputs = computed(() => comfyStore.outputs)

const reset = () => {
  queryForm.taskId = undefined
  queryForm.taskBatchId = undefined
  search()
}

const previewVisible = ref(false)
const previewUrl = ref('')

const onPreviewCloud = (record: ComfyTaskOutputResp) => {
  previewUrl.value = buildViewUrl(record.endpointUrl, record)
  previewVisible.value = true
}

const onDownloadCloud = async (record: ComfyTaskOutputResp) => {
  try {
    await downloadOutput(record.endpointUrl, record)
  } catch (error) {
    Message.error((error as Error).message || '下载失败')
  }
}

const onPreviewLocal = (record: ComfyLocalOutput) => {
  previewUrl.value = buildViewUrl(record.endpointUrl, record)
  previewVisible.value = true
}

const onDownloadLocal = async (record: ComfyLocalOutput) => {
  try {
    await downloadOutput(record.endpointUrl, record)
  } catch (error) {
    Message.error((error as Error).message || '下载失败')
  }
}

const onClearLocal = () => {
  Modal.warning({
    title: '确认清空本地输出记录？',
    content: '仅清除浏览器中保存的输出引用，不会删除 ComfyUI 已生成的文件。',
    okText: '清空',
    cancelText: '取消',
    onOk: () => {
      comfyStore.clear()
      Message.success('已清空')
    },
  })
}

onMounted(() => {
  search()
})
</script>

<style scoped lang="scss">
.comfy-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.preview-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 240px;

  img {
    max-width: 100%;
    max-height: 60vh;
    object-fit: contain;
  }
}
</style>
