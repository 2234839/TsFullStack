import type { API } from '../../api';

export type ModelMeta = Awaited<ReturnType<typeof API.system.getModelMeta>>;
export type modelNames = keyof ModelMeta['models'];
export type Fields = ModelMeta['models'][modelNames]['fields'];
export type Field2 = Fields[keyof Fields]; // Extracts the type of each field in the fields object
export type Field = {
  name: string;
  type: 'DateTime';
  isId?: boolean;
  isAutoIncrement?: boolean;
  isDataModel?: boolean;
  isArray?: boolean;
  backLink?: string;
  isRelationOwner?: boolean;

  attributes: {
    name: string;
    args: (
      | never
      | {
          value: number;
        }
    )[];
  }[];
};
