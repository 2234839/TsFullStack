/**
 * 用户信息管理 Composable
 * 用于获取和更新当前用户的信息（头像、昵称等）
 */
import { API } from '@/api';
import { DEFAULT_AVATAR_URL } from '@/utils/constants';
import { authInfo, authInfo_isLogin } from '@/storage';
import { createSharedComposable } from '@vueuse/core';
import { getErrorMessage } from '@/utils/error';
import { computed, ref, readonly, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';

/** 用户信息接口 */
export interface UserProfile {
  /** 用户 ID */
  id: string;
  /** 用户邮箱 */
  email: string;
  /** 用户头像 URL */
  avatar: string | null;
  /** 用户昵称 */
  nickname: string | null;
}

/**
 * 用户信息管理 Composable
 * 提供用户信息的获取、更新和响应式状态
 */
export const useUserProfile = createSharedComposable(() => {
  const { t } = useI18n();

  /** 用户信息响应式数据 */
  const userProfile = ref<UserProfile | null>(null);
  /** 加载状态 */
  const loading = ref(false);
  /** 错误信息 */
  const error = ref<string | null>(null);

  /**
   * 计算属性：显示名称
   * 优先使用 nickname，如果没有则使用邮箱的前半部分
   */
  const displayName = computed(() => {
    if (!userProfile.value) {
      return t('未登录');
    }
    if (userProfile.value.nickname) {
      return userProfile.value.nickname;
    }
    // 从邮箱中提取用户名部分
    const emailPrefix = userProfile.value.email.split('@')[0];
    return emailPrefix;
  });

  /**
   * 计算属性：头像 URL（兼容旧用法，直接返回完整 URL）
   */
  const avatarUrl = computed<string>(() => {
    if (!userProfile.value) {
      return DEFAULT_AVATAR_URL;
    }
    return userProfile.value.avatar ?? DEFAULT_AVATAR_URL;
  });

  /**
   * 计算属性：头像文件 ID
   * 仅当用户设置了自定义头像（数据库中存的是文件 ID）时返回，否则为 null
   */
  const avatarFileId = computed<string | null>(() => {
    return userProfile.value?.avatar ?? null;
  });

  /**
   * 获取当前用户信息
   */
  async function fetchUserProfile() {
    if (!authInfo_isLogin.value || !authInfo.value?.userId) {
      userProfile.value = null;
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const user = await API.db.user.findUnique({
        where: { id: authInfo.value.userId },
        select: {
          id: true,
          email: true,
          avatar: true,
          nickname: true,
        },
      });

      if (user) {
        userProfile.value = {
          id: user.id,
          email: user.email,
          avatar: user.avatar,
          nickname: user.nickname,
        };
      }
    } catch (err: unknown) {
      error.value = getErrorMessage(err, t('获取用户信息失败'));
    } finally {
      loading.value = false;
    }
  }

  /**
   * 更新用户昵称
   */
  async function updateNickname(nickname: string) {
    if (!authInfo.value?.userId) {
      throw new Error(t('用户未登录'));
    }

    await API.db.user.update({
      where: { id: authInfo.value.userId },
      data: { nickname },
    });

    // 更新本地状态
    if (userProfile.value) {
      userProfile.value.nickname = nickname;
    }

    return true;
  }

  /**
   * 更新用户头像
   */
  async function updateAvatar(avatarUrl: string) {
    if (!authInfo.value?.userId) {
      throw new Error(t('用户未登录'));
    }

    await API.db.user.update({
      where: { id: authInfo.value.userId },
      data: { avatar: avatarUrl },
    });

    // 更新本地状态
    if (userProfile.value) {
      userProfile.value.avatar = avatarUrl;
    }
  }

  /**
   * 刷新用户信息
   */
  async function refresh() {
    await fetchUserProfile();
  }

  // 监听登录状态变化，自动获取用户信息
  watch(authInfo_isLogin, (isLoggedIn) => {
    if (isLoggedIn) {
      fetchUserProfile();
    } else {
      userProfile.value = null;
    }
  }, { immediate: true });

  return {
    /** 用户信息（只读，防止外部整体替换） */
    userProfile: readonly(userProfile),
    /** 显示名称 */
    displayName,
    /** 头像 URL */
    avatarUrl,
    /** 头像文件 ID（仅自定义头像时有值） */
    avatarFileId,
    /** 加载状态（只读） */
    loading: readonly(loading),
    /** 错误信息（只读） */
    error: readonly(error),
    /** 获取用户信息 */
    fetchUserProfile,
    /** 更新昵称 */
    updateNickname,
    /** 更新头像 */
    updateAvatar,
    /** 刷新用户信息 */
    refresh,
  };
});
