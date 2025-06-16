/**
 * VoiceArticle Chrome Extension - Type Definitions
 * 多言語対応とテーマ切り替え機能の型定義
 */

export interface LanguageOption {
  code: string;
  name: string;
}

export enum UiTheme {
  LIGHT = "light",
  DARK = "dark",
}
