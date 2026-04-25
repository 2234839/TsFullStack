<template>
  <div class="flex flex-col min-h-screen bg-primary-50 dark:bg-primary-900">
    <!-- 头部导航栏 -->
    <header
      class="flex items-center justify-between p-4 bg-white dark:bg-primary-800 border-b border-primary-200 dark:border-primary-700 shadow-sm">
      <div class="hidden md:flex items-center gap-2">
        <div class="w-8 h-8 text-secondary-600 dark:text-secondary-400">
          <i class="pi pi-calculator text-2xl!"></i>
        </div>
        <h1 class="text-xl font-bold text-secondary-700 dark:text-secondary-400">
          {{ ti18n('计算笔记本') }}
        </h1>
      </div>
      <div class="flex items-center gap-2">
        <Button icon="pi pi-file" :label="ti18n('新建')" variant="text-button" @click="handleNewDocument($event)"
          :title="ti18n('新建文档')" />
        <Button icon="pi pi-save" :label="ti18n('保存')" variant="text-button" @click="saveCurrentNote"
          :disabled="!authInfo_isLogin || isSaving" :loading="isSaving" :title="ti18n('保存到云端,需要登录后才能使用')" />
        <Button icon="pi pi-share-alt" :label="ti18n('分享')" variant="text-button" @click="handleShare()"
          :title="ti18n('分享当前文档')" />
        <Button icon="pi pi-cog" variant="icon" rounded @click="showSettings = !showSettings"
          :title="ti18n('设置')" />
        <CommonSettingBtns />
      </div>
    </header>

    <!-- 主体内容区 -->
    <div class="flex flex-1 overflow-hidden">
      <!-- 侧边栏抽屉 -->
      <Drawer v-model:open="sidebarVisible" side="left" width="320px">
        <template #header>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-secondary-700 dark:text-secondary-400">
              {{ ti18n('我的笔记') }}
            </h2>
            <div class="flex gap-2">
              <Button icon="pi pi-refresh" variant="text" rounded @click="refreshNotes"
                :loading="notesState.isLoading.value" :title="ti18n('刷新笔记列表')" />
            </div>
          </div>
        </template>
        <div class="p-4 flex flex-col h-full">
          <InputGroup class="mb-4">
            <InputGroupAddon :clickable="false">
              <i class="pi pi-search" />
            </InputGroupAddon>
            <Input v-model="searchQuery" :placeholder="ti18n('搜索笔记...')" class="w-full" />
            <InputGroupAddon v-if="searchQuery" clickable @click="clearSearch()">
              <i class="pi pi-times" />
            </InputGroupAddon>
          </InputGroup>
          <div v-if="!authInfo_isLogin" class="flex-1 flex items-center justify-center">
            <div class="text-center p-4">
              <i class="pi pi-lock text-4xl mb-2 text-primary-400 dark:text-primary-500"></i>
              <p class="text-primary-500 dark:text-primary-400">{{ ti18n('请登录后查看您的笔记') }}</p>
              <Button @click="
                  routerUtil.push(routeMap.login, {}, { r: route.fullPath }),
                    (sidebarVisible = false)
                ">{{ ti18n('登录') }}</Button>
            </div>
          </div>

          <div v-else-if="notesState.isLoading.value && !notesState.state.value.length"
            class="flex-1 flex items-center justify-center">
            <ProgressSpinner size="normal" />
          </div>

          <div v-else-if="!notesState.state.value.length" class="flex-1 flex items-center justify-center">
            <div class="text-center p-4">
              <i class="pi pi-file-o text-4xl mb-2 text-primary-400 dark:text-primary-500"></i>
              <p class="text-primary-500 dark:text-primary-400">
                {{ searchQuery ? ti18n('未找到匹配的笔记') : ti18n('暂无笔记') }}
              </p>
            </div>
          </div>

          <div v-else class="flex-1 overflow-y-auto">
            <TransitionGroup name="list" tag="ul" class="p-0 m-0 list-none">
              <li v-for="note in notesState.state.value" :key="note.id" class="mb-2">
                <div
                  class="p-3 rounded-lg border border-primary-200 dark:border-primary-700 hover:bg-primary-100 dark:hover:bg-primary-800 cursor-pointer transition-colors"
                  :class="{ 'bg-secondary-50 dark:bg-secondary-900/30': currentNoteId === note.id }" @click="loadNote(note)">
                  <div class="flex items-center justify-between">
                    <div class="truncate font-medium">
                      {{ getNoteTitle(note) }}
                    </div>
                    <div class="flex gap-1">
                      <Button icon="pi pi-pencil" variant="icon" rounded size="sm"
                        @click="showRenameDialog(note)" :title="ti18n('重命名')" />
                      <Button icon="pi pi-trash" variant="icon" rounded size="sm"
                        @click.stop="confirmDeleteNote(note, $event)" :title="ti18n('删除')" />
                    </div>
                  </div>
                  <div class="text-xs text-primary-500 dark:text-primary-400 mt-1 flex justify-between">
                    <span>{{ formatDate(note.updated) }}</span>
                    <span>{{ getContentPreview(note) }}</span>
                  </div>
                </div>
              </li>
            </TransitionGroup>

            <!-- 分页加载更多 -->
            <div v-if="hasMoreNotes" class="mt-4 text-center">
              <Button :label="ti18n('加载更多')" icon="pi pi-chevron-down" variant="text-button" size="sm"
                :loading="isLoadingMore" @click="loadMoreNotes" />
            </div>
          </div>
        </div>
      </Drawer>

      <!-- 双栏编辑区 -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <div class="p-2 bg-white dark:bg-primary-800 border-b border-primary-200 dark:border-primary-700 flex items-center">
          <Button icon="pi pi-bars" variant="icon" rounded class="mr-2"
            @click="sidebarVisible = !sidebarVisible" :title="ti18n('显示/隐藏侧边栏')" />

          <div class="flex-1 flex items-center">
            <span v-if="currentNote" class="font-medium truncate">
              {{ getNoteTitle(currentNote) }}
            </span>
            <span v-else class="text-primary-500 dark:text-primary-400">{{ ti18n('未保存的笔记') }}</span>

            <span v-if="unsavedChanges" class="ml-2 text-xs text-warning-500 dark:text-warning-400">
              <i class="pi pi-exclamation-circle mr-1"></i>{{ ti18n('未保存') }}
            </span>
          </div>

          <div v-if="config.autoSaveEnabled" class="text-xs text-primary-500 dark:text-primary-400 flex items-center">
            <i class="pi pi-clock mr-1"></i>
            <span v-if="lastSaved">{{ ti18n('上次保存') }}: {{ lastSaved_v }}</span>
            <span v-else>{{ ti18n('自动保存已启用') }}</span>
          </div>
        </div>

        <div class="flex-1 overflow-hidden">
          <CodeMirrorEditor v-model="content" :config="config" />
        </div>
      </div>
    </div>
    <SponsorshipCard class="mt-6" />

    <!-- 设置面板 -->
    <Dialog v-model:open="showSettings" :title="ti18n('设置')">
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <label class="font-medium">{{ ti18n('自动计算') }}</label>
          <ToggleSwitch v-model="config.isAutoCalculate" />
        </div>
        <div class="flex items-center justify-between">
          <label class="font-medium">{{ ti18n('自动保存') }}</label>
          <ToggleSwitch v-model="config.autoSaveEnabled" />
        </div>
        <div class="flex justify-between items-center">
          <label class="font-medium">{{ ti18n('自动保存间隔') }}</label>
          <div class="flex items-center">
            <InputNumber v-model="config.autoSaveInterval" :min="5" :max="60" :disabled="!config.autoSaveEnabled"
              show-buttons />
            <span class="ml-2 text-primary-500 dark:text-primary-400">{{ ti18n('秒') }}</span>
          </div>
        </div>
        <div class="flex justify-between items-center">
          <label class="font-medium">{{ ti18n('结果显示精度') }}</label>
          <div class="flex items-center">
            <InputNumber v-model="config.showPrecision" :min="1" :max="100" show-buttons />
            <span class="ml-2 text-primary-500 dark:text-primary-400">{{ ti18n('位') }}</span>
          </div>
        </div>
        <div class="flex justify-between items-center">
          <label class="font-medium">{{ ti18n('计算精度') }}</label>
          <div class="flex items-center">
            <InputNumber v-model="config.precision" :min="1" :max="100" show-buttons />
            <span class="ml-2 text-primary-500 dark:text-primary-400">{{ ti18n('位') }}</span>
          </div>
        </div>
      </div>
    </Dialog>

    <!-- 重命名对话框 -->
    <Dialog v-model:open="showRenameModal" :title="ti18n('重命名笔记')">
      <div class="space-y-4">
        <div class="flex flex-col">
          <label for="noteTitle" class="mb-2 font-medium">{{ ti18n('笔记标题') }}</label>
          <Input id="noteTitle" v-model="renameTitle" class="w-full" />
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <Button :label="ti18n('取消')" variant="text" @click="showRenameModal = false" />
          <Button :label="ti18n('保存')" @click="saveRename" :disabled="!renameTitle.trim()" />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
  import { exampleContent } from '@/pages/noteCalc/exampleContent';
  import { useAsyncState, useDebounceFn, useIntervalFn, useThrottleFn } from '@vueuse/core';
  import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

  import { API } from '@/api';
  import CommonSettingBtns from '@/components/system/CommonSettingBtns.vue';
  import CodeMirrorEditor from '@/pages/noteCalc/CodeMirrorEditor.vue';
  import { routeMap, router, routerUtil } from '@/router';
  import { authInfo, authInfo_isLogin } from '@/storage';
  import { formatDate, truncateText, parseJsonField } from '@/utils/format';
  import { userDataAppid } from '@/storage/userDataAppid';
  import { useSharePlus } from '@/utils/hooks/useSharePlus';
  import { Dialog, Drawer } from '@tsfullstack/shared-frontend/components';
  import { useConfirm } from '@/composables/useConfirm';
  import { useToast } from '@/composables/useToast';
  import { useRoute } from 'vue-router';
  import { useI18n } from '@/composables/useI18n';
  import type { DbListItem } from '@/utils/apiType';

  const toast = useToast();
  const route = useRoute();
  const confirm = useConfirm();
  const { t: ti18n } = useI18n();

  const { c, id } = defineProps<{
    /** lz-string 压缩后的内容  */
    c?: string;
    /** 笔记ID */
    id?: string;
  }>();

  //#region 状态管理
  const content = ref(c || id ? '' : exampleContent);
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

  /** WhereInput 类型 - 从 API 推断 */
  type UserDataWhereInput = NonNullable<Parameters<typeof API.db.userData.findMany>[0]>['where']
  type Note = NonNullable<Awaited<ReturnType<typeof API.db.userData.findMany>>>[number]

  /** 笔记中存储的计算器配置 */
  interface NoteConfig {
    isAutoCalculate?: boolean;
    precision?: number;
    showPrecision?: number;
    autoSaveEnabled?: boolean;
    autoSaveInterval?: number;
    [key: string]: unknown;
  }
  // 笔记状态
  const notesState = useAsyncState(
    async () => {
      if (!authInfo_isLogin.value) return [];

      try {
        // 获取笔记列表，根据是否有搜索关键词决定查询方式
        const baseWhere = {
          appId: userDataAppid.NodeCalc,
          userId: authInfo.value?.userId,
        };

        // 如果有搜索关键词，添加搜索条件
        const where: UserDataWhereInput = searchQuery.value.trim()
          ? {
              ...baseWhere,
              OR: [
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
              ],
            }
          : baseWhere

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
      } catch (error: unknown) {
        toast.error(ti18n('加载失败'), ti18n('获取笔记列表时出错'));
        return [];
      }
    },
    [],
    { immediate: false },
  );

  /** 笔记类型（从 API 推导，JsonValue 截断已解决 TS2589） */
  type SimpleNote = DbListItem<'userData'>;

  const currentNote = ref<SimpleNote | null>(null);
  const currentNoteId = computed(() => currentNote.value?.id);
  const unsavedChanges = computed(() => {
    const noteConfig = currentNote.value ? getConfigFromData(currentNote.value) : null;
    const configIsDifferent =
      currentNote.value &&
      noteConfig !== null &&
      JSON.stringify(noteConfig) !== JSON.stringify(config.value);

    return configIsDifferent;
  });
  const isSaving = ref(false);

  // 自动保存
  const lastSaved = ref<Date | null>(null);
  const lastSaved_v = computed(() => {
    if (!lastSaved.value) return '';
    return formatDate(lastSaved.value, { relative: true });
  });

  // 重命名对话框
  const showRenameModal = ref(false);
  const renameTitle = ref('');
  const noteToRename = ref<Note | null>(null);
  //#endregion

  /** 清除搜索 */
  const clearSearch = () => {
    searchQuery.value = '';
    // 重新加载笔记列表
    currentPage.value = 1;
    loadNotes();
  };

  /** 获取笔记标题 */
  const getNoteTitle = (note: { description: string | null } | null | undefined) => {
    return note?.description ?? ti18n('未命名笔记');
  };

  /** 获取笔记内容预览 */
  const getContentPreview = (note: Note) => {
    const content = getContentFromData(note);
    if (!content) return '';

    // 获取第一行非空内容
    const firstLine = content.split('\n').find((line) => line.trim());
    if (!firstLine) return '';

    // 截取前20个字符
    return truncateText(firstLine, 20);
  };

  /** 从笔记数据中获取内容 */
  const getContentFromData = (note: Note) => {
    try {
      if (!note.data) return '';
      const data = parseJsonField<{ content?: string }>(note.data);
      return data.content ?? '';
    } catch {
      return '';
    }
  };

  /** 从笔记数据中获取配置 */
  const getConfigFromData = (note: { data: unknown }): NoteConfig | null => {
    try {
      if (!note.data) return null;
      const data = parseJsonField<{ config?: NoteConfig }>(note.data);
      return data.config ?? null;
    } catch {
      return null;
    }
  };

  /** 加载笔记列表 */
  const loadNotes = () => {
    if (!authInfo_isLogin.value) return;
    notesState.execute();
  };

  /** 加载更多笔记 */
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
    } catch (error: unknown) {
      toast.error(ti18n('加载失败'), ti18n('获取更多笔记时出错'));
    } finally {
      isLoadingMore.value = false;
    }
  };

  /** 刷新笔记列表 */
  const refreshNotes = () => {
    currentPage.value = 1;
    loadNotes();
  };

  /** 根据ID加载笔记 */
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
          toast.error(ti18n('加载失败'), ti18n('未找到指定笔记'));
          return;
        }
      }

      doLoadNote(note);

      // 更新URL，保留id参数
      router.replace({
        path: route.path,
        query: { id: id.toString() },
      });
    } catch (error: unknown) {
      toast.error(ti18n('加载失败'), ti18n('加载指定笔记时出错'));
    }
  };

  /** 加载笔记内容 */
  const loadNote = (note: Note) => {
    try {
      // 如果有未保存的更改，提示用户
      if (unsavedChanges.value && currentNote.value) {
        confirm.require({
          message: ti18n('当前笔记有未保存的更改，是否继续？'),
          header: ti18n('未保存的更改'),
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
    } catch (error: unknown) {
      toast.error(ti18n('加载失败'), ti18n('加载笔记内容时出错'));
    }
  };

  /** 更新URL中的笔记ID */
  const updateUrlWithNoteId = (id: number) => {
    router.replace({
      path: route.path,
      query: { id: id.toString() },
    });
  };

  /** 实际加载笔记的函数 */
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

  /** 保存当前笔记 */
  const saveCurrentNote = async () => {
    if (!authInfo_isLogin.value) {
      toast.warn(ti18n('未登录'), ti18n('请先登录后再保存笔记'));
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
          const note = notesState.state.value[index];
          if (!note) return;
          note.data = noteData;
          note.updated = new Date();

          // 将更新的笔记移到列表顶部
          const updatedNoteItem = notesState.state.value.splice(index, 1)[0];
          if (updatedNoteItem) {
            notesState.state.value.unshift(updatedNoteItem);
          }
        }

        currentNote.value = updatedNote;

        toast.success(ti18n('保存成功'), ti18n('笔记已更新'));
      } else {
        // 创建新笔记
        const title = content.value.split('\n')[0]?.trim() ?? ti18n('未命名笔记');
        const newNote = await API.db.userData.create({
          data: {
            appId: userDataAppid.NodeCalc,
            userId: authInfo.value?.userId,
            key: `note_${Date.now()}`,
            data: noteData,
            description: truncateText(title, 30),
          },
        });

        // 添加到本地笔记列表
        notesState.state.value.unshift(newNote);
        currentNote.value = newNote;

        // 更新URL
        updateUrlWithNoteId(newNote.id);

        // 更新总数
        totalNotes.value += 1;

        toast.success(ti18n('保存成功'), ti18n('新笔记已创建'));
      }

      lastSaved.value = new Date();
    } catch (error: unknown) {
      toast.error(ti18n('保存失败'), ti18n('保存笔记时出错'));
    } finally {
      isSaving.value = false;
    }
  };

  /** 自动保存（useIntervalFn 自动在组件卸载时清理） */
  const { pause: pauseAutoSave, resume: resumeAutoSave } = useIntervalFn(
    () => {
      if (unsavedChanges.value && currentNote.value) {
        saveCurrentNote();
      }
    },
    () => (config.value.autoSaveEnabled && authInfo_isLogin.value ? config.value.autoSaveInterval * 1000 : 0),
    { immediate: false },
  );

  /** 根据当前配置启用或暂停自动保存 */
  const syncAutoSave = () => {
    if (config.value.autoSaveEnabled && authInfo_isLogin.value) {
      resumeAutoSave();
    } else {
      pauseAutoSave();
    }
  };

  /** 确认删除笔记 */
  const confirmDeleteNote = (note: Note, event: MouseEvent) => {
    confirm.require({
      message: ti18n('确定要删除笔记"{title}"吗？', { title: getNoteTitle(note) }),
      icon: 'pi pi-exclamation-triangle',
      event,
      acceptProps: {
        variant: 'danger',
      },
      accept: () => {
        deleteNote(note);
      },
    });
  };

  /** 删除笔记 */
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

      toast.success(ti18n('删除成功'), ti18n('笔记已删除'));
    } catch (error: unknown) {
      toast.error(ti18n('删除失败'), ti18n('删除笔记时出错'));
    }
  };

  /** 显示重命名对话框 */
  const showRenameDialog = (note: Note) => {
    noteToRename.value = note;
    renameTitle.value = getNoteTitle(note);
    showRenameModal.value = true;
  };

  /** 保存重命名 */
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
        const note = notesState.state.value[index];
        if (!note) return;
        note.description = renameTitle.value.trim();
        note.updated = new Date();
      }

      // 如果重命名的是当前笔记，更新当前笔记
      if (currentNote.value?.id === noteToRename.value.id) {
        currentNote.value.description = renameTitle.value.trim();
      }

      showRenameModal.value = false;
      toast.success(ti18n('重命名成功'), ti18n('笔记已重命名'));
    } catch (error: unknown) {
      toast.error(ti18n('重命名失败'), ti18n('重命名笔记时出错'));
    }
  };

  /** 处理新建文档 */
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
      message: ti18n('是否确定新建文档？当前内容将被清空。'),
      icon: 'pi pi-exclamation-triangle',
      event,
      rejectProps: {
        label: ti18n('取消'),
        variant: 'secondary',
        outlined: true,
      },
      acceptProps: {
        label: ti18n('确定'),
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
    } catch (error: unknown) {
      toast.error(ti18n('分享失败'), ti18n('生成分享链接时出错，请重试'));
    }
  };

  /** 从URL参数加载内容 */
  const loadContentFromUrl = async () => {
    try {
      // 优先检查是否有笔记ID
      if (id && authInfo_isLogin.value) {
        const noteId = parseInt(id);
        if (!isNaN(noteId)) {
          await loadNoteById(noteId);
          return;
        }
      }

      // 如果没有ID或ID无效，检查是否有压缩内容
      const compressedContent = c;
      if (!compressedContent) return;

      // 解压内容
      const decompressedContent = decompressFromEncodedURIComponent(compressedContent);

      if (!decompressedContent) return;
      content.value = decompressedContent;
    } catch (error: unknown) {
      toast.error(ti18n('加载失败'), ti18n('从分享链接加载内容时出错'));
    }
  };

  /** 更新url参数 - 仅在未保存的笔记且没有当前笔记ID时使用 */
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

  /** 防抖搜索（在 watch 外部创建，避免每次触发都新建闭包） */
  const debouncedSearch = useDebounceFn(() => {
    if (authInfo_isLogin.value) {
      currentPage.value = 1;
      notesState.execute();
    }
  }, 500);

  // 监听搜索查询变化
  watch(searchQuery, () => debouncedSearch());

  // 监听自动保存设置变化
  watch(
    () => [config.value.autoSaveEnabled, config.value.autoSaveInterval],
    () => {
      syncAutoSave();
    },
  );

  // 监听登录状态变化
  watch(
    () => authInfo_isLogin.value,
    (newValue) => {
      if (newValue) {
        loadNotes();
        syncAutoSave();

        // 如果URL中有笔记ID，尝试加载
        if (id) {
          const noteId = parseInt(id);
          if (!isNaN(noteId)) {
            loadNoteById(noteId);
          }
        }
      } else {
        pauseAutoSave();
      }
    },
  );

  // 组件挂载
  onMounted(() => {
    // 加载笔记列表
    if (authInfo_isLogin.value) {
      loadNotes();
      syncAutoSave();
    }

    // 尝试从URL加载内容
    loadContentFromUrl();
  });

  // 组件卸载前
  onBeforeUnmount(() => {
    pauseAutoSave();
  });
</script>

<style scoped>
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
