import type { API } from "../../api";

export type ModelMeta = Awaited<ReturnType<typeof API.system.getModelMeta>>;
export type modelNames = keyof ModelMeta['models'];