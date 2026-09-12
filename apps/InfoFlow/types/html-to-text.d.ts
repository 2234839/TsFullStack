/**
 * html-to-text v10 移除了官方类型声明（@types/html-to-text 只覆盖 9.x）。
 * 这里为项目实际用到的 convert API 提供最小类型声明。
 */
declare module "html-to-text" {
  export interface HtmlToTextOptions {
    wordwrap?: number | false | null;
    selectors?: SelectorDefinition[];
    formatters?: Record<string, Formatter>;
    tags?: Record<string, TagDefinition>;
    decodeOptions?: {
      isAttributeValue?: boolean;
      strict?: boolean;
      scope?: "body" | "nonStrict";
    };
    limits?: {
      ellipsisLocation?: "start" | "end" | "middle";
      maxChildNodes?: number | false;
      maxDepth?: number | false;
      maxInputLength?: number | false;
      maxLineLength?: number | false;
      truncateFilename?: number | false;
      ellipsis?: string;
    };
    longWordSplit?: {
      forceWrapOnLimit?: boolean;
      wrapCharacters?: string[];
    };
    hideLinkHrefIfSameAsText?: boolean;
    ignoreHref?: boolean;
    ignoreImage?: boolean;
    preserveNewlines?: boolean;
    uppercaseHeadings?: boolean;
    whitespaceCharacters?: string;
    [key: string]: unknown;
  }

  export type SelectorDefinition = {
    selector: string;
    format?: string;
    options?: Record<string, unknown>;
    [key: string]: unknown;
  };

  export type Formatter = (
    elem: unknown,
    walk: (elem: unknown, options: HtmlToTextOptions) => void,
    options: HtmlToTextOptions,
    inspect: unknown,
  ) => void;

  export type TagDefinition = {
    format?: string | false;
    options?: Record<string, unknown>;
    [key: string]: unknown;
  };

  /**
   * 将 HTML 转换为纯文本
   */
  export function convert(html: string, options?: HtmlToTextOptions): string;
  export function compile(options?: HtmlToTextOptions): (html: string) => string;
  export { convert as htmlToText };
}
