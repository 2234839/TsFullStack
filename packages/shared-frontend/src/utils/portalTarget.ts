/**
 * Portal 插入点注入：弹层组件（Dialog/Popover/Select/Dropdown）通过 reka-ui Portal
 * teleport 到注入的容器，而不是写死 body。使用方（App 布局根）调用 providePortalTarget
 * 把自己的根元素 provide 出来，弹层落在配色作用域内，文字颜色随继承自然适配明暗主题。
 */
import { computed, inject, provide, toValue, type MaybeRefOrGetter, type InjectionKey, type Ref } from 'vue';

/** Portal 插入点注入键 */
const PortalTargetKey: InjectionKey<MaybeRefOrGetter<string | HTMLElement | null>> = Symbol('PortalTarget');

/**
 * 使用方（布局根组件）在 setup 内同步调用，provide 弹层插入点
 * @param target CSS 选择器、DOM 元素或其响应式引用（元素挂载后自动生效）
 */
export function providePortalTarget(target: MaybeRefOrGetter<string | HTMLElement | null>): void {
  provide(PortalTargetKey, target);
}

/**
 * 弹层组件获取插入点，未注入或元素未挂载时回退 body
 * @returns 响应式的 CSS 选择器或 DOM 元素（保证非空，可直接绑 Portal 的 to）
 */
export function usePortalTarget(): Ref<string | HTMLElement> {
  const injected = inject(PortalTargetKey, () => 'body');
  return computed(() => {
    const v = toValue(injected);
    if (v === null) return 'body';
    return v ?? 'body';
  });
}
