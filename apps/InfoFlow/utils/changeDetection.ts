import type { CollectionItem, TaskResult } from '@/services/InfoFlowGet/messageProtocol';

export interface ItemWithChanges extends CollectionItem {
  changeType: 'added' | 'removed' | 'moved' | 'unchanged';
  currentIndex: number;
  previousIndex: number;
}

export interface CollectionWithChanges {
  items: ItemWithChanges[];
  timestamp: string;
  executionTime: number;
}

export interface TaskResultWithChanges {
  url: string;
  title: string;
  timestamp: string;
  matched: 0 | 1;
  message?: string;
  data?: any;
  collections?: Record<string, CollectionWithChanges>;
}



// 计算两个collection之间的变化
export function calculateChanges(
  currentItems: CollectionItem[],
  previousItems: CollectionItem[],
): ItemWithChanges[] {
  return currentItems.map((currentItem, index) => {
    // 在前一次执行中查找相同的item
    const previousIndex = previousItems.findIndex((prevItem) => 
      prevItem.value === currentItem.value && 
      prevItem.type === currentItem.type &&
      prevItem.selector === currentItem.selector &&
      prevItem.attribute === currentItem.attribute
    );

    let changeType: ItemWithChanges['changeType'] = 'added'; // 默认为新增
    let previousIndexInPrevious = -1;

    if (previousIndex !== -1) {
      // 找到了相同的item，检查位置是否变化
      if (previousIndex === index) {
        changeType = 'unchanged'; // 位置未变化
      } else {
        changeType = 'moved'; // 位置变化
      }
      previousIndexInPrevious = previousIndex;
    }

    return {
      ...currentItem,
      changeType,
      currentIndex: index,
      previousIndex: previousIndexInPrevious,
    };
  });
}

// 为执行结果添加变化信息
export function getExecutionWithChanges(
  currentExecution: { result?: TaskResult; startTime?: string | Date },
  previousExecution: { result?: TaskResult; startTime?: string | Date } | null,
): TaskResultWithChanges {
  if (!currentExecution.result?.collections) {
    return currentExecution as TaskResultWithChanges;
  }

  if (!previousExecution?.result?.collections) {
    // 如果没有前一次执行，所有item都标记为新增
    const collectionsWithChanges: Record<string, CollectionWithChanges> = {};
    Object.keys(currentExecution.result.collections).forEach(key => {
      const collection = currentExecution.result!.collections![key];
      collectionsWithChanges[key] = {
        ...collection,
        items: collection.items.map((item, index: number) => ({
          ...item,
          changeType: 'added' as const,
          currentIndex: index,
          previousIndex: -1,
        })),
      };
    });

    return {
      ...currentExecution.result,
      collections: collectionsWithChanges,
    };
  }

  // 有前一次执行，计算变化
  const collectionsWithChanges: Record<string, CollectionWithChanges> = {};
  Object.keys(currentExecution.result.collections).forEach(key => {
    const currentCollection = currentExecution.result!.collections![key];
    const previousCollection = previousExecution?.result?.collections?.[key];
    
    if (previousCollection?.items) {
      collectionsWithChanges[key] = {
        ...currentCollection,
        items: calculateChanges(currentCollection.items, previousCollection.items),
      };
    } else {
      // 前一次执行没有这个collection，所有item都标记为新增
      collectionsWithChanges[key] = {
        ...currentCollection,
        items: currentCollection.items.map((item, index: number) => ({
          ...item,
          changeType: 'added' as const,
          currentIndex: index,
          previousIndex: -1,
        })),
      };
    }
  });

  return {
    ...currentExecution.result,
    collections: collectionsWithChanges,
  };
}

// 检查执行结果是否所有项都无变化
export function checkIfAllUnchanged(executionWithChanges: TaskResultWithChanges): boolean {
  if (!executionWithChanges.collections) {
    return false;
  }

  for (const collectionKey in executionWithChanges.collections) {
    const collection = executionWithChanges.collections[collectionKey];
    if (collection.items && collection.items.length > 0) {
      // 检查是否所有项都是"unchanged"类型
      const hasChanges = collection.items.some((item: ItemWithChanges) => 
        item.changeType && item.changeType !== 'unchanged'
      );
      if (hasChanges) {
        return false; // 如果有任何变化，返回false
      }
    }
  }

  return true; // 所有项都无变化
}

// 检查执行结果是否没有新增项
export function checkIfNoAdditions(executionWithChanges: TaskResultWithChanges): boolean {
  if (!executionWithChanges.collections) {
    return false;
  }

  for (const collectionKey in executionWithChanges.collections) {
    const collection = executionWithChanges.collections[collectionKey];
    if (collection.items && collection.items.length > 0) {
      // 检查是否有任何新增项
      const hasAdditions = collection.items.some((item: ItemWithChanges) => 
        item.changeType === 'added'
      );
      if (hasAdditions) {
        return false; // 如果有新增项，返回false
      }
    }
  }

  return true; // 没有新增项
}