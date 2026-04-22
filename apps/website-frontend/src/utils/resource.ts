/** 资源项（文件 + 可选 metadata） */
interface ResourceItemLike {
  file?: { id: number | string } | null;
  metadata?: unknown;
}

/**
 * 获取资源的显示 URL
 * 优先返回文件 API 路径，其次从 metadata.externalUrl 中提取
 */
export function getResourceUrl(resource: ResourceItemLike): string {
  if (resource.file) {
    return `/api/fileApi/file/${resource.file.id}`;
  }
  if (resource.metadata && typeof resource.metadata === 'object' && !Array.isArray(resource.metadata)) {
    const metadata = resource.metadata as Record<string, unknown>;
    return (metadata.externalUrl as string) || '';
  }
  return '';
}
