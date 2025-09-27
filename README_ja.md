# TsFullStack

[English](./README.md) [简体中文](./README_zh.md) [日本語](./README_ja.md) [한국어](./README_ko.md) [Français](./README_fr.md) [Deutsch](./README_de.md) [Español](./README_es.md)

---

これは私の TypeScript フルスタックベストプラクティスプロジェクトです。データモデルを定義した後、バックエンド API コードを書くことなくフロントエンドから直接データベースを操作でき、MVP モデルを迅速に開発できます。

> 従来の管理画面ページには本当にうんざりしています。もう二度と書きたくありません。

[オンライン体験](http://tsfullstack.heartstack.space/)

[![zread](https://img.shields.io/badge/Ask_Zread-_.svg)](https://zread.ai/2234839/TsFullStack) [プロジェクトオンラインAIドキュメント](https://zread.ai/2234839/TsFullStack)

[ドキュメントアドレス](https://shenzilong.cn/index/TsFullStack.html#20250413211142-d533spm)

## 特徴

- バックエンド
  - 技術スタック：TypeScript + Prisma + ZenStack + Effect + Fastify
  - ZenStack（Prisma ベースの拡張ソリューション）を使用してデータベースモデリングと Row Level Security を実装。

- ブリッジ
  - 技術スタック：TypeScript + SuperJSON + 自社開発 RPC ライブラリ
  - フロントエンドから直接バックエンド API を呼び出し、完全な TypeScript タイプヒントがあり、ミドルウェアコードを記述する必要がありません。
  - SuperJSON は Date、Map、Set、RegExp などの複雑なオブジェクトのシリアライズとデシリアライズをサポートし、Prisma の引数と戻り値をシームレスに渡すことを保証します。

- フロントエンド
  - 技術スタック：TypeScript + Vue 3 + Tailwind CSS + PrimeVue コンポーネントライブラリ
  - 完璧な i18n 国際化サポートを提供し、ページを再読み込みすることなくすべての詳細が多言語動的切り替えをサポートします。
  - 明暗テーマ切り替え、コンポーネントと Tailwind CSS が動的切り替えを同期サポート。
  - 実装された機能ページ
    - Prisma Studio 風の管理パネル（ある程度彼のオープンソース代替案として使用可能）、画一的な CRUD ページを書く必要がなくなります。
    - [NoteCalc](https://tsfullstack.heartstack.space/noteCalc) 中国語に優しいリアルタイム計算ノートブック
    - [AiEnglish](https://tsfullstack.heartstack.space/AiEnglish) 読書を通じて段階的に英語を学習

その他のアプリケーションデモ

- ブラウザ拡張機能 - InfoFlow
  - https://wxt.dev/guide/installation.html に基づいて構築され、tsfullstack をブラウザ拡張機能のバックエンドサポートとして使用する方法を示します。

## クイックスタート

1. プロジェクトをクローン
2. 依存関係のインストール：backend ディレクトリに移動し、`pnpm i` を実行して依存関係をインストール（エラーを無視：Failed to resolve entry for package "@tsfullstack/backend"、このパッケージは後の手順で生成します）
3. データベースの初期化：backend ディレクトリで `pnpm zenstack generate` と `pnpm prisma migrate dev` を実行
4. @tsfullstack/backend API パッケージをコンパイル：backend ディレクトリで `pnpm build:lib` を実行（いくつかのタイプエラーが報告されますが、現時点では良い解決策が見つかっていませんが、使用には影響しないので無視してください）
5. バックエンドサービスを起動：backend ディレクトリで `pnpm dev` を実行
6. フロントエンドサービスを起動：website-frontend ディレクトリで `pnpm dev` を実行

## プロジェクト構造設計

> [設計理念](https://shenzilong.cn/index/如何实现模块化加载的前端和后端代码.html)

- プロジェクトベース
  - apps/website-frontend がフロントエンドベースプロジェクト
  - apps/backend がバックエンドベースプロジェクト
- モジュール化フロントエンド・バックエンドプロジェクトコード
  - modules/*
  - モジュール内のフロントエンドコードは、モジュール内のバックエンドコードインターフェースを直接参照できます