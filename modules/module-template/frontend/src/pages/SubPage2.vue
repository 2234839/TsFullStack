<template>
  <div class="subpage2">
    <Card>
      <template #title>
        <div class="flex items-center gap-2">
          <i class="pi pi-table"></i>
          <span>子页面 2 - 数据表格</span>
        </div>
      </template>

      <div class="space-y-6">
        <Message severity="success" :closable="false">
          这是 Module Template 的子页面 2，展示了数据表格和交互功能。
        </Message>

        <Card>
          <template #subtitle>数据表格</template>
          <DataTable :value="products" responsiveLayout="scroll">
            <Column field="id" header="ID" sortable></Column>
            <Column field="name" header="产品名称" sortable></Column>
            <Column field="category" header="分类" sortable></Column>
            <Column field="price" header="价格" sortable>
              <template #body="slotProps">
                <span>¥{{ slotProps.data.price }}</span>
              </template>
            </Column>
            <Column field="status" header="状态">
              <template #body="slotProps">
                <Tag
                  :value="slotProps.data.status"
                  :severity="getStatusSeverity(slotProps.data.status)"
                />
              </template>
            </Column>
            <Column header="操作">
              <template #body="slotProps">
                <Button
                  icon="pi pi-eye"
                  rounded
                  text
                  @click="viewProduct(slotProps.data)"
                />
                <Button
                  icon="pi pi-pencil"
                  rounded
                  text
                  severity="warning"
                  @click="editProduct(slotProps.data)"
                />
              </template>
            </Column>
          </DataTable>
        </Card>

        <Card>
          <template #subtitle>统计信息</template>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="text-center">
              <div class="text-2xl font-bold text-blue-600">{{ products.length }}</div>
              <div class="text-sm text-gray-600">总产品数</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-green-600">{{ activeProducts }}</div>
              <div class="text-sm text-gray-600">激活产品</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-orange-600">{{ totalValue }}</div>
              <div class="text-sm text-gray-600">总价值</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-purple-600">{{ categories.length }}</div>
              <div class="text-sm text-gray-600">分类数</div>
            </div>
          </div>
        </Card>

        <div class="flex justify-between">
          <Button
            label="返回子页面 1"
            icon="pi pi-arrow-left"
            @click="router.push('/module-template/subpage1')"
            severity="secondary"
          />
          <Button
            label="前往设置"
            icon="pi pi-cog"
            @click="router.push('/module-template/settings')"
            severity="warning"
          />
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const products = ref([
  { id: 1, name: '产品 A', category: '电子产品', price: 2999, status: 'active' },
  { id: 2, name: '产品 B', category: '家居用品', price: 159, status: 'active' },
  { id: 3, name: '产品 C', category: '服装', price: 299, status: 'inactive' },
  { id: 4, name: '产品 D', category: '电子产品', price: 4999, status: 'active' },
  { id: 5, name: '产品 E', category: '图书', price: 59, status: 'pending' }
])

const activeProducts = computed(() =>
  products.value.filter(p => p.status === 'active').length
)

const totalValue = computed(() =>
  products.value.reduce((sum, p) => sum + p.price, 0)
)

const categories = computed(() =>
  [...new Set(products.value.map(p => p.category))]
)

const getStatusSeverity = (status: string) => {
  switch (status) {
    case 'active': return 'success'
    case 'inactive': return 'danger'
    case 'pending': return 'warning'
    default: return 'info'
  }
}

const viewProduct = (product: any) => {
  alert(`查看产品: ${product.name}`)
}

const editProduct = (product: any) => {
  alert(`编辑产品: ${product.name}`)
}
</script>

<style scoped>
.subpage2 {
  margin: 0 auto;
  padding: 1.5rem;
  max-width: 1280px;
}
</style>