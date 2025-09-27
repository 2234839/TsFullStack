# TsFullStack

[English Document](./README.md) [中文文档](./README_zh.md) [Japanese Document](./README_ja.md) [Korean Document](./README_ko.md) [French Document](./README_fr.md) [German Document](./README_de.md) [Spanish Document](./README_es.md)

---

이것은 제 ts 풀스택 모범 사례 프로젝트입니다. 데이터 모델을 정의한 후에 백엔드 API 코드를 작성하지 않고도 프론트엔드에서 직접 데이터베이스를 조작할 수 있어 MVP 모델을 빠르게 개발할 수 있습니다.

> 전통적인 관리자 페이지에는 정말 지쳤고, 이제는 더 이상 작성하고 싶지 않습니다.

[온라인 체험](http://tsfullstack.heartstack.space/)

[프로젝트 온라인 AI 문서](https://zread.ai/2234839/TsFullStack)

[문서 주소](https://shenzilong.cn/index/TsFullStack.html#20250413211142-d533spm)

## 특징

- 백엔드
  - 기술 스택: ts + prisma + zenstack + Effect + fastify
  - zenstack(prisma 기반 강화 솔루션)으로 데이터베이스 모델링과 Row Level Security를 구현합니다.

- 브릿지
  - 기술 스택: ts + superjson + 자체 개발 RPC 라이브러리
  - 프론트엔드에서 백엔드 API를 직접 호출하며 완전한 ts 타입 힌트를 제공하며, 미들웨어 코드를 작성할 필요가 없습니다.
  - superjson은 Date, Map, Set, RegExp 등 복잡한 객체의 직렬화와 역직렬화를 지원하여 prisma의 입력 매개변수와 반환 결과를 원활하게 전달할 수 있습니다.

- 프론트엔드
  - 기술 스택: ts + vue3 + tailwindcss + primevue 컴포넌트 라이브러리
  - 완벽한 i18n 국제화 지원으로 모든 세부사항이 페이지 리로드 없이 동적으로 다국어 전환을 지원합니다.
  - 밝은/어두운 테마 전환으로 컴포넌트와 tailwindcss가 동적으로 전환을 지원합니다.
  - 구현된 기능 페이지
    - prisma studio 유사 관리자 패널(어느 정도 오픈소스 대안으로 사용 가능), 더 이상 획일적인 CRUD 페이지를 작성할 필요가 없습니다.
    - [NoteCalc](https://tsfullstack.heartstack.space/noteCalc) 중국어 친화적인 실시간 계산 노트북
    - [AiEnglish](https://tsfullstack.heartstack.space/AiEnglish) 독서 중 점진적으로 영어 학습

기타 애플리케이션 데모

- 브라우저 확장 - InfoFlow
  - https://wxt.dev/guide/installation.html 기반으로 구축되었으며, tsfullstack을 브라우저 확장의 백엔드 지원으로 사용하는 방법을 보여줍니다.

## 빠른 시작

1. 프로젝트 클론
2. 의존성 설치: backend 디렉토리로 이동하여 `pnpm i` 실행 (오류 무시: Failed to resolve entry for package "@tsfullstack/backend", 이후 단계에서 이 패키지를 생성할 것입니다)
3. 데이터베이스 초기화: backend 디렉토리에서 `pnpm zenstack generate`와 `pnpm prisma migrate dev` 실행
4. @tsfullstack/backend API 패키지 컴파일: backend 디렉토리에서 `pnpm build:lib` 실행 (일부 타입 오류가 발생할 수 있으나 현재 좋은 해결책을 찾지 못했지만 사용에는 영향이 없으므로 무시하세요)
5. 백엔드 서비스 시작: backend 디렉토리에서 `pnpm dev` 실행
6. 프론트엔드 서비스 시작: website-frontend 디렉토리에서 `pnpm dev` 실행

## 프로젝트 구조 설계

> [설계 철학](https://shenzilong.cn/index/如何实现模块化加载的前端和后端代码.html)

- 프로젝트 기반
  - apps/website-frontend를 프론트엔드 기반 프로젝트로
  - apps/backend를 백엔드 기반 프로젝트로
- 모듈화된 프론트엔드 및 백엔드 프로젝트 코드
  - modules/*
  - 모듈 내부의 프론트엔드 코드는 모듈 내부의 백엔드 코드 인터페이스를 직접 참조할 수 있습니다