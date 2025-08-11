<template>
  <div class="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- 头部导航栏 -->
    <header
      class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 text-purple-600 dark:text-purple-400">
          <i class="pi pi-calculator text-2xl!"></i>
        </div>
        <h1 class="text-xl font-bold text-purple-700 dark:text-purple-400">
          {{ $t('计算笔记本') }}
        </h1>
      </div>
      <div class="flex items-center gap-2">
        <Button
          icon="pi pi-file"
          :label="$t('新建')"
          class="p-button-outlined"
          @click="handleNewDocument($event)"
          :title="$t('新建文档')" />
        <Button
          icon="pi pi-save"
          :label="$t('保存')"
          class="p-button-outlined"
          @click="saveCurrentNote"
          :disabled="!authInfo_isLogin || isSaving"
          :loading="isSaving"
          :title="$t('保存到云端,需要登录后才能使用')" />
        <Button
          icon="pi pi-share-alt"
          :label="$t('分享')"
          class="p-button-outlined"
          @click="handleShare()"
          :title="$t('分享当前文档')" />
        <Button
          icon="pi pi-cog"
          class="p-button-outlined p-button-rounded"
          @click="showSettings = !showSettings"
          :title="$t('设置')" />
        <CommonSettingBtns />
      </div>
    </header>

    <!-- 主体内容区 -->
    <div class="flex flex-1 overflow-hidden">
      <!-- 侧边栏抽屉 -->
      <Drawer v-model:visible="sidebarVisible" :pt="{ root: { class: 'w-80 p-0' } }">
        <template #header>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-purple-700 dark:text-purple-400">
              {{ $t('我的笔记') }}
            </h2>
            <div class="flex gap-2">
              <Button
                icon="pi pi-refresh"
                class="p-button-text p-button-rounded"
                @click="refreshNotes"
                :loading="notesState.isLoading.value"
                :title="$t('刷新笔记列表')" />
            </div>
          </div>
        </template>
        <div class="p-4 flex flex-col h-full">
          <InputGroup class="mb-4">
            <InputGroupAddon>
              <i class="pi pi-search" />
            </InputGroupAddon>
            <InputText v-model="searchQuery" :placeholder="$t('搜索笔记...')" class="w-full" />
            <InputGroupAddon v-if="searchQuery">
              <i class="pi pi-times" @click="clearSearch()" />
            </InputGroupAddon>
          </InputGroup>
          <div v-if="!authInfo_isLogin" class="flex-1 flex items-center justify-center">
            <div class="text-center p-4">
              <i class="pi pi-lock text-4xl mb-2 text-gray-400"></i>
              <p class="text-gray-500">{{ $t('请登录后查看您的笔记') }}</p>
              <Button
                @click="
                  routerUtil.push(routeMap.login, {}, { r: $route.fullPath }),
                    (sidebarVisible = false)
                "
                >{{ $t('登录') }}</Button
              >
            </div>
          </div>

          <div
            v-else-if="notesState.isLoading.value && !notesState.state.value.length"
            class="flex-1 flex items-center justify-center">
            <ProgressSpinner style="width: 50px; height: 50px" />
          </div>

          <div
            v-else-if="!notesState.state.value.length"
            class="flex-1 flex items-center justify-center">
            <div class="text-center p-4">
              <i class="pi pi-file-o text-4xl mb-2 text-gray-400"></i>
              <p class="text-gray-500">
                {{ searchQuery ? $t('未找到匹配的笔记') : $t('暂无笔记') }}
              </p>
            </div>
          </div>

          <div v-else class="flex-1 overflow-y-auto">
            <TransitionGroup name="list" tag="ul" class="p-0 m-0 list-none">
              <li v-for="note in notesState.state.value" :key="note.id" class="mb-2">
                <div
                  class="p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  :class="{ 'bg-purple-50 dark:bg-purple-900/30': currentNoteId === note.id }"
                  @click="loadNote(note)">
                  <div class="flex items-center justify-between">
                    <div class="truncate font-medium">
                      {{ getNoteTitle(note) }}
                    </div>
                    <div class="flex gap-1">
                      <Button
                        icon="pi pi-pencil"
                        class="p-button-text p-button-rounded p-button-sm"
                        @click="showRenameDialog(note)"
                        :title="$t('重命名')" />
                      <Button
                        icon="pi pi-trash"
                        class="p-button-text p-button-rounded p-button-danger p-button-sm"
                        @click.stop="confirmDeleteNote(note, $event)"
                        :title="$t('删除')" />
                    </div>
                  </div>
                  <div class="text-xs text-gray-500 mt-1 flex justify-between">
                    <span>{{ formatDate(note.updated) }}</span>
                    <span>{{ getContentPreview(note) }}</span>
                  </div>
                </div>
              </li>
            </TransitionGroup>

            <!-- 分页加载更多 -->
            <div v-if="hasMoreNotes" class="mt-4 text-center">
              <Button
                :label="$t('加载更多')"
                icon="pi pi-chevron-down"
                class="p-button-text p-button-sm"
                :loading="isLoadingMore"
                @click="loadMoreNotes" />
            </div>
          </div>
        </div>
      </Drawer>

      <!-- 双栏编辑区 -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <div
          class="p-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center">
          <Button
            icon="pi pi-bars"
            class="p-button-text p-button-rounded mr-2"
            @click="sidebarVisible = !sidebarVisible"
            :title="$t('显示/隐藏侧边栏')" />

          <div class="flex-1 flex items-center">
            <span v-if="currentNote" class="font-medium truncate">
              {{ getNoteTitle(currentNote) }}
            </span>
            <span v-else class="text-gray-500">{{ $t('未保存的笔记') }}</span>

            <span v-if="unsavedChanges" class="ml-2 text-xs text-orange-500">
              <i class="pi pi-exclamation-circle mr-1"></i>{{ $t('未保存') }}
            </span>
          </div>

          <div v-if="config.autoSaveEnabled" class="text-xs text-gray-500 flex items-center">
            <i class="pi pi-clock mr-1"></i>
            <span v-if="lastSaved">{{ $t('上次保存') }}: {{ lastSaved_v }}</span>
            <span v-else>{{ $t('自动保存已启用') }}</span>
          </div>
        </div>

        <div class="flex-1 overflow-hidden">
          <NoteCalcCore v-model="content" v-model:config="config" />
        </div>
      </div>
    </div>
    <SponsorshipCard class="mt-6" />

    <!-- 设置面板 -->
    <Dialog v-model:visible="showSettings" :header="$t('设置')" modal class="w-[30rem]">
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <label class="font-medium">{{ $t('自动计算') }}</label>
          <ToggleSwitch v-model="config.isAutoCalculate" />
        </div>
        <div class="flex items-center justify-between">
          <label class="font-medium">{{ $t('自动保存') }}</label>
          <ToggleSwitch v-model="config.autoSaveEnabled" />
        </div>
        <div class="flex justify-between items-center">
          <label class="font-medium">{{ $t('自动保存间隔') }}</label>
          <div class="flex items-center">
            <InputNumber
              v-model="config.autoSaveInterval"
              :min="5"
              :max="60"
              :disabled="!config.autoSaveEnabled"
              showButtons
              buttonLayout="horizontal"
              decrementButtonClass="p-button-secondary"
              incrementButtonClass="p-button-secondary" />
            <span class="ml-2 text-gray-500">{{ $t('秒') }}</span>
          </div>
        </div>
        <div class="flex justify-between items-center">
          <label class="font-medium">{{ $t('结果显示精度') }}</label>
          <div class="flex items-center">
            <InputNumber
              v-model="config.showPrecision"
              :min="1"
              :max="100"
              showButtons
              buttonLayout="horizontal"
              decrementButtonClass="p-button-secondary"
              incrementButtonClass="p-button-secondary" />
            <span class="ml-2 text-gray-500">{{ $t('位') }}</span>
          </div>
        </div>
        <div class="flex justify-between items-center">
          <label class="font-medium">{{ $t('计算精度') }}</label>
          <div class="flex items-center">
            <InputNumber
              v-model="config.precision"
              :min="1"
              :max="100"
              showButtons
              buttonLayout="horizontal"
              decrementButtonClass="p-button-secondary"
              incrementButtonClass="p-button-secondary" />
            <span class="ml-2 text-gray-500">{{ $t('位') }}</span>
          </div>
        </div>
      </div>
    </Dialog>

    <!-- 重命名对话框 -->
    <Dialog v-model:visible="showRenameModal" :header="$t('重命名笔记')" modal class="w-[25rem]">
      <div class="space-y-4">
        <div class="flex flex-col">
          <label for="noteTitle" class="mb-2 font-medium">{{ $t('笔记标题') }}</label>
          <InputText id="noteTitle" v-model="renameTitle" class="w-full" />
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <Button :label="$t('取消')" class="p-button-text" @click="showRenameModal = false" />
          <Button :label="$t('保存')" @click="saveRename" :disabled="!renameTitle.trim()" />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
  import { exampleContent } from '@/pages/noteCalc/exampleContent';
  import { useAsyncState, useDebounceFn, useThrottleFn, useTimestamp } from '@vueuse/core';
  import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

  import { API } from '@/api';
  import CommonSettingBtns from '@/components/system/CommonSettingBtns.vue';
  import { t } from '@/i18n';
  import NoteCalcCore from '@/pages/noteCalc/NoteCalcCore.vue';
  import { routeMap, router, routerUtil } from '@/router';
  import { authInfo, authInfo_isLogin } from '@/storage';
  import { userDataAppid } from '@/storage/userDataAppid';
  import { useSharePlus } from '@/utils/hooks/useSharePlus';
  import {
    Button,
    Dialog,
    Drawer,
    InputGroup,
    InputGroupAddon,
    InputNumber,
    InputText,
    ProgressSpinner,
    ToggleSwitch,
    useConfirm,
    useToast,
  } from 'primevue';
  import type { Prisma } from 'tsfullstack-backend';
  import { useRoute } from 'vue-router';

  const toast = useToast();
  const route = useRoute();
  const confirm = useConfirm();

  const props = defineProps<{
    /** lz-string 压缩后的内容  */
    c?: string;
    /** 笔记ID */
    id?: string;
  }>();

  //#region 状态管理
  const content = ref(props.c || props.id ? '' : exampleContent);
  const config = ref({
    isAutoCalculate: true,
    precision: 64,
    showPrecision: 4,
    autoSaveEnabled: true,
    /** 单位为秒 */
    autoSaveInterval: 10,
  });
  const showSettings = ref(false);

  // 侧边栏状态
  const sidebarVisible = ref(false);
  const searchQuery = ref('');

  // 分页相关
  const pageSize = 10; // 每页加载的笔记数量
  const currentPage = ref(1);
  const hasMoreNotes = ref(false);
  const isLoadingMore = ref(false);
  const totalNotes = ref(0);

  type Note = Awaited<ReturnType<typeof API.db.userData.findMany>>[0]; // 笔记类型
  // 笔记状态
  const notesState = useAsyncState(
    async () => {
      if (!authInfo_isLogin.value) return [];

      try {
        // 获取笔记列表，根据是否有搜索关键词决定查询方式
        const where: Prisma.UserDataWhereInput = {
          appId: userDataAppid.NodeCalc,
          userId: authInfo.value?.userId,
        };

        // 如果有搜索关键词，添加搜索条件
        if (searchQuery.value.trim()) {
          where.OR = [
            // 搜索标题
            {
              description: {
                contains: searchQuery.value,
              },
            },
            // 搜索内容
            {
              data: {
                path: 'content',
                string_contains: searchQuery.value,
              },
            },
          ];
        }

        // 获取总数
        const count = await API.db.userData.count({ where });
        totalNotes.value = count;

        // 判断是否有更多笔记
        const skip = searchQuery.value.trim() ? 0 : (currentPage.value - 1) * pageSize;
        const take = searchQuery.value.trim() ? count : pageSize; // 搜索时获取所有结果

        hasMoreNotes.value = !searchQuery.value.trim() && skip + take < count;

        // 分页获取笔记
        const res = await API.db.userData.findMany({
          where,
          orderBy: {
            updated: 'desc',
          },
          take,
          skip,
        });

        return res;
      } catch (error) {
        console.error('加载笔记列表失败:', error);
        toast.add({
          severity: 'error',
          summary: '加载失败',
          detail: '获取笔记列表时出错',
          life: 3000,
        });
        return [];
      }
    },
    [],
    { immediate: false },
  );

  const currentNote = ref<Note | null>(null);
  const currentNoteId = computed(() => currentNote.value?.id);
  const unsavedChanges = computed(() => {
    const contentIsDifferent =
      currentNote.value && getContentFromData(currentNote.value) !== content.value;
    const configIsDifferent =
      currentNote.value &&
      JSON.stringify(getConfigFromData(currentNote.value)) !== JSON.stringify(config.value);

    return contentIsDifferent || configIsDifferent;
  });
  const isSaving = ref(false);

  // 自动保存
  const lastSaved = ref<Date | null>(null);
  const now = useTimestamp();
  const lastSaved_v = computed(() => {
    if (!lastSaved.value) return '';

    const diffInSeconds = Math.floor((now.value - lastSaved.value.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds}秒前`;
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}分钟前`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}小时前`;
    } else {
      // 超过1天，显示完整日期（例如 "2023/10/05"）
      return lastSaved.value.toLocaleDateString('zh-CN');
    }
  });
  let autoSaveTimer: number | null = null;

  // 重命名对话框
  const showRenameModal = ref(false);
  const renameTitle = ref('');
  const noteToRename = ref<Note | null>(null);
  //#endregion

  // 清除搜索
  const clearSearch = () => {
    searchQuery.value = '';
    // 重新加载笔记列表
    currentPage.value = 1;
    loadNotes();
  };

  // 获取笔记标题
  const getNoteTitle = (note: Note) => {
    return note.description || '未命名笔记';
  };

  // 获取笔记内容预览
  const getContentPreview = (note: Note) => {
    const content = getContentFromData(note);
    if (!content) return '';

    // 获取第一行非空内容
    const firstLine = content.split('\n').find((line) => line.trim());
    if (!firstLine) return '';

    // 截取前20个字符
    return firstLine.length > 20 ? firstLine.substring(0, 20) + '...' : firstLine;
  };

  // 格式化日期
  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 从笔记数据中获取内容
  const getContentFromData = (note: Note) => {
    try {
      if (!note.data) return '';
      const data = typeof note.data === 'string' ? JSON.parse(note.data) : note.data;
      return (data.content || '') as string;
    } catch (e) {
      console.error('解析笔记内容失败:', e);
      return '';
    }
  };

  // 从笔记数据中获取配置
  const getConfigFromData = (note: Note) => {
    try {
      if (!note.data) return null;
      const data = typeof note.data === 'string' ? JSON.parse(note.data) : note.data;
      return data.config || null;
    } catch (e) {
      console.error('解析笔记配置失败:', e);
      return null;
    }
  };

  // 加载笔记列表
  const loadNotes = () => {
    if (!authInfo_isLogin.value) return;
    notesState.execute();
  };

  // 加载更多笔记
  const loadMoreNotes = async () => {
    if (
      isLoadingMore.value ||
      !hasMoreNotes.value ||
      !authInfo_isLogin.value ||
      searchQuery.value.trim()
    )
      return;

    isLoadingMore.value = true;
    try {
      const nextPage = currentPage.value + 1;
      const skip = (nextPage - 1) * pageSize;

      const moreNotes = await API.db.userData.findMany({
        where: {
          appId: userDataAppid.NodeCalc,
          userId: authInfo.value?.userId,
        },
        orderBy: {
          updated: 'desc',
        },
        take: pageSize,
        skip: skip,
      });

      if (moreNotes.length > 0) {
        // 添加到现有列表
        notesState.state.value = [...notesState.state.value, ...moreNotes];
        currentPage.value = nextPage;

        // 检查是否还有更多笔记
        hasMoreNotes.value = notesState.state.value.length < totalNotes.value;
      } else {
        hasMoreNotes.value = false;
      }
    } catch (error) {
      console.error('加载更多笔记失败:', error);
      toast.add({
        severity: 'error',
        summary: '加载失败',
        detail: '获取更多笔记时出错',
        life: 3000,
      });
    } finally {
      isLoadingMore.value = false;
    }
  };

  // 刷新笔记列表
  const refreshNotes = () => {
    currentPage.value = 1;
    loadNotes();
  };

  // 根据ID加载笔记
  const loadNoteById = async (id: number) => {
    try {
      // 先查找本地列表中是否有该笔记
      let note = notesState.state.value.find((n) => n.id === id);

      // 如果本地没有，则从服务器获取
      if (!note) {
        note =
          (await API.db.userData.findUnique({
            where: { id },
          })) || undefined;

        if (!note) {
          toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: '未找到指定笔记',
            life: 3000,
          });
          return;
        }
      }

      doLoadNote(note);

      // 更新URL，保留id参数
      router.replace({
        path: route.path,
        query: { id: id.toString() },
      });
    } catch (error) {
      console.error('根据ID加载笔记失败:', error);
      toast.add({
        severity: 'error',
        summary: '加载失败',
        detail: '加载指定笔记时出错',
        life: 3000,
      });
    }
  };

  // 加载笔记内容
  const loadNote = (note: Note) => {
    try {
      // 如果有未保存的更改，提示用户
      if (unsavedChanges.value && currentNote.value) {
        confirm.require({
          message: '当前笔记有未保存的更改，是否继续？',
          header: '未保存的更改',
          icon: 'pi pi-exclamation-triangle',
          accept: () => {
            doLoadNote(note);
            updateUrlWithNoteId(note.id);
          },
        });
      } else {
        doLoadNote(note);
        updateUrlWithNoteId(note.id);
      }
    } catch (error) {
      console.error('加载笔记内容失败:', error);
      toast.add({
        severity: 'error',
        summary: '加载失败',
        detail: '加载笔记内容时出错',
        life: 3000,
      });
    }
  };

  // 更新URL中的笔记ID
  const updateUrlWithNoteId = (id: number) => {
    router.replace({
      path: route.path,
      query: { id: id.toString() },
    });
  };

  // 实际加载笔记的函数
  const doLoadNote = (note: Note) => {
    const noteContent = getContentFromData(note);
    const noteConfig = getConfigFromData(note);

    content.value = noteContent || '';

    if (noteConfig) {
      Object.assign(config.value, noteConfig);
    }

    currentNote.value = note;
    lastSaved.value = new Date(note.updated);
  };

  // 保存当前笔记
  const saveCurrentNote = async () => {
    if (!authInfo_isLogin.value) {
      toast.add({
        severity: 'warn',
        summary: '未登录',
        detail: '请先登录后再保存笔记',
        life: 3000,
      });
      return;
    }

    isSaving.value = true;
    try {
      const noteData = {
        content: content.value,
        config:config.value,
      };

      if (currentNote.value) {
        // 更新现有笔记
        const updatedNote = await API.db.userData.update({
          where: { id: currentNote.value.id },
          data: {
            data: noteData,
            version: currentNote.value.version + 1,
            updated: new Date(),
          },
        });

        // 更新本地笔记列表中的数据
        const index = notesState.state.value.findIndex((note) => note.id === currentNote.value?.id);
        if (index !== -1) {
          notesState.state.value[index].data = noteData;
          notesState.state.value[index].updated = new Date();

          // 将更新的笔记移到列表顶部
          const updatedNoteItem = notesState.state.value.splice(index, 1)[0];
          notesState.state.value.unshift(updatedNoteItem);
        }

        currentNote.value = updatedNote;

        toast.add({
          severity: 'success',
          summary: '保存成功',
          detail: '笔记已更新',
          life: 2000,
        });
      } else {
        // 创建新笔记
        const title = content.value.split('\n')[0]?.trim() || '未命名笔记';
        const newNote = await API.db.userData.create({
          data: {
            appId: userDataAppid.NodeCalc,
            userId: authInfo.value!.userId,
            key: 'note_' + Date.now(),
            data: noteData,
            description: title.length > 30 ? title.substring(0, 30) + '...' : title,
          },
        });

        // 添加到本地笔记列表
        notesState.state.value.unshift(newNote);
        currentNote.value = newNote;

        // 更新URL
        updateUrlWithNoteId(newNote.id);

        // 更新总数
        totalNotes.value += 1;

        toast.add({
          severity: 'success',
          summary: '保存成功',
          detail: '新笔记已创建',
          life: 2000,
        });
      }

      lastSaved.value = new Date();
    } catch (error) {
      console.error('保存笔记失败:', error);
      toast.add({
        severity: 'error',
        summary: '保存失败',
        detail: '保存笔记时出错',
        life: 3000,
      });
    } finally {
      isSaving.value = false;
    }
  };

  // 自动保存
  const setupAutoSave = () => {
    clearAutoSave();

    if (config.value.autoSaveEnabled && authInfo_isLogin.value) {
      autoSaveTimer = window.setInterval(() => {
        if (unsavedChanges.value && currentNote.value) {
          saveCurrentNote();
        }
      }, config.value.autoSaveInterval * 1000);
    }
  };

  // 清除自动保存定时器
  const clearAutoSave = () => {
    if (autoSaveTimer !== null) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
    }
  };

  // 确认删除笔记
  const confirmDeleteNote = (note: Note, event: MouseEvent) => {
    confirm.require({
      target: event.currentTarget as HTMLElement,
      message: `确定要删除笔记"${getNoteTitle(note)}"吗？`,
      icon: 'pi pi-exclamation-triangle',
      acceptClass: 'p-button-danger',
      accept: () => {
        deleteNote(note);
      },
    });
  };

  // 删除笔记
  const deleteNote = async (note: Note) => {
    try {
      await API.db.userData.delete({
        where: { id: note.id },
      });

      // 从本地列表中移除
      notesState.state.value = notesState.state.value.filter((n) => n.id !== note.id);

      // 更新总数
      totalNotes.value -= 1;

      // 如果删除的是当前笔记，清空当前笔记
      if (currentNote.value?.id === note.id) {
        currentNote.value = null;
        // 清除URL中的id参数
        router.replace({ path: route.path });
      }

      toast.add({
        severity: 'success',
        summary: '删除成功',
        detail: '笔记已删除',
        life: 2000,
      });
    } catch (error) {
      console.error('删除笔记失败:', error);
      toast.add({
        severity: 'error',
        summary: '删除失败',
        detail: '删除笔记时出错',
        life: 3000,
      });
    }
  };

  // 显示重命名对话框
  const showRenameDialog = (note: Note) => {
    noteToRename.value = note;
    renameTitle.value = getNoteTitle(note);
    showRenameModal.value = true;
  };

  // 保存重命名
  const saveRename = async () => {
    if (!noteToRename.value || !renameTitle.value.trim()) return;

    try {
      await API.db.userData.update({
        where: { id: noteToRename.value.id },
        data: {
          description: renameTitle.value.trim(),
          updated: new Date(),
        },
      });

      // 更新本地笔记列表
      const index = notesState.state.value.findIndex((note) => note.id === noteToRename.value?.id);
      if (index !== -1) {
        notesState.state.value[index].description = renameTitle.value.trim();
        notesState.state.value[index].updated = new Date();
      }

      // 如果重命名的是当前笔记，更新当前笔记
      if (currentNote.value?.id === noteToRename.value.id) {
        currentNote.value.description = renameTitle.value.trim();
      }

      showRenameModal.value = false;
      toast.add({
        severity: 'success',
        summary: '重命名成功',
        detail: '笔记已重命名',
        life: 2000,
      });
    } catch (error) {
      console.error('重命名笔记失败:', error);
      toast.add({
        severity: 'error',
        summary: '重命名失败',
        detail: '重命名笔记时出错',
        life: 3000,
      });
    }
  };

  // 处理新建文档
  const handleNewDocument = (event: MouseEvent) => {
    const confirmNewDocument = () => {
      content.value = '';
      currentNote.value = null;
      // 清除URL中的id参数
      router.replace({ path: route.path });
    };

    if (content.value.trim() === '') {
      // 如果内容为空，直接清除当前笔记
      confirmNewDocument();
      return;
    }

    confirm.require({
      target: event.currentTarget! as HTMLElement,
      message: t('是否确定新建文档？当前内容将被清空。'),
      icon: 'pi pi-exclamation-triangle',
      rejectProps: {
        label: 'Cancel',
        severity: 'secondary',
        outlined: true,
      },
      acceptProps: {
        label: 'Ok',
      },
      accept: () => {
        confirmNewDocument();
      },
      reject: () => {},
    });
  };

  const { share } = useSharePlus();
  const handleShare = () => {
    try {
      let shareUrl = '';

      if (currentNote.value) {
        // 如果是云端笔记，使用ID分享
        shareUrl = `${window.location.origin}${window.location.pathname}?id=${currentNote.value.id}`;
      } else {
        // 如果是未保存的笔记，使用内容压缩分享
        const compressedContent = compressToEncodedURIComponent(content.value);
        shareUrl = `${window.location.origin}${window.location.pathname}?c=${compressedContent}`;
      }

      share({
        title: 'noteCalc',
        text: '',
        url: shareUrl,
      });
    } catch (error) {
      console.error('分享失败:', error);
      toast.add({
        severity: 'error',
        summary: '分享失败',
        detail: '生成分享链接时出错，请重试',
        life: 3000,
      });
    }
  };

  // 从URL参数加载内容
  const loadContentFromUrl = async () => {
    try {
      // 优先检查是否有笔记ID
      if (props.id && authInfo_isLogin.value) {
        const noteId = parseInt(props.id);
        if (!isNaN(noteId)) {
          await loadNoteById(noteId);
          return;
        }
      }

      // 如果没有ID或ID无效，检查是否有压缩内容
      const compressedContent = props.c;
      if (!compressedContent) return;

      // 解压内容
      const decompressedContent = decompressFromEncodedURIComponent(compressedContent);

      if (!decompressedContent) return;
      content.value = decompressedContent;
    } catch (error) {
      console.error('从URL加载内容失败:', error);
      toast.add({
        severity: 'error',
        summary: '加载失败',
        detail: '从分享链接加载内容时出错',
        life: 3000,
      });
    }
  };

  // 更新url参数 - 仅在未保存的笔记且没有当前笔记ID时使用
  const throttleUpdateQuery = useThrottleFn(
    () => {
      // 如果有当前笔记ID，不更新c参数
      if (currentNote.value) return;

      const compressedContent = compressToEncodedURIComponent(content.value);
      router.replace({ query: { c: compressedContent } });
    },
    1200,
    true,
  );

  // 监听内容变化
  watch(
    content,
    () => {
      // 仅在没有当前笔记时更新URL
      if (!currentNote.value) {
        throttleUpdateQuery();
      }
    },
    { deep: false },
  );

  // 监听搜索查询变化
  watch(searchQuery, () => {
    // 使用防抖处理搜索
    const debouncedSearch = useDebounceFn(() => {
      if (authInfo_isLogin.value) {
        currentPage.value = 1;
        notesState.execute();
      }
    }, 500);

    debouncedSearch();
  });

  // 监听自动保存设置变化
  watch(
    () => [config.value.autoSaveEnabled, config.value.autoSaveInterval],
    () => {
      setupAutoSave();
    },
  );

  // 监听登录状态变化
  watch(
    () => authInfo_isLogin.value,
    (newValue) => {
      if (newValue) {
        loadNotes();
        setupAutoSave();

        // 如果URL中有笔记ID，尝试加载
        if (props.id) {
          const noteId = parseInt(props.id);
          if (!isNaN(noteId)) {
            loadNoteById(noteId);
          }
        }
      } else {
        clearAutoSave();
      }
    },
  );

  // 组件挂载
  onMounted(() => {
    // 加载笔记列表
    if (authInfo_isLogin.value) {
      loadNotes();
      setupAutoSave();
    }

    // 尝试从URL加载内容
    loadContentFromUrl();
  });

  // 组件卸载前
  onBeforeUnmount(() => {
    clearAutoSave();
  });
</script>

<style>
  .list-enter-active,
  .list-leave-active {
    transition: all 0.3s ease;
  }
  .list-enter-from,
  .list-leave-to {
    opacity: 0;
    transform: translateX(-20px);
  }
</style>
