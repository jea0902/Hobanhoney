# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트

호반꿀 — 트레이딩/투자 인간지표 대시보드 (Next.js 풀스택 웹앱).
장기적으로 AI 퀀트 트레이딩 기능까지 확장 예정.

## 기술스택

- Next.js 14 (App Router), TypeScript, Tailwind CSS
- 패키지 매니저: npm
- 새 라이브러리 도입 전엔 먼저 물어봐 — 임의로 추가하지 마

## 코딩 원칙 (가장 중요)

- 무조건 단순하게. 영리한 코드보다 읽자마자 이해되는 코드
- 같은 로직이 3번 이상 반복되기 전까지는 함수/컴포넌트로 추상화하지 마
- 한 함수는 한 가지 일만. 길어지면 나누기보다 먼저 "정말 필요한 로직인지" 되물어봐
- 새 패턴/라이브러리 도입보다 이미 쓰는 방식 재사용을 우선
- 주석은 "왜"만 설명. "무엇"은 코드 자체로 읽혀야 함

## 절대 하지 말 것

- localStorage/sessionStorage 사용 금지 → 서버 상태나 DB로 관리
- 환경변수 하드코딩 금지 → .env 파일로
- 확인 안 된 API/함수 지어내서 쓰기 금지 → 모르면 문서 찾아보거나 나한테 물어봐
- 존재 확인 안 한 파일 경로 언급 금지 → 먼저 읽고 나서 참조

## 확실하지 않을 때

- 추측으로 진행하지 말고 질문해
- 여러 방법이 있으면 가장 단순한 쪽을 기본으로 제안하고, 왜 그런지 한 줄로 설명

## 실행 명령어

```bash
npm run dev            # 로컬 개발 서버 (http://localhost:3000)
npm run build           # 빌드 확인 (타입체크 + ESLint 포함)
npm run start            # 프로덕션 빌드 서빙
npm run lint             # ESLint 체크
npm run format            # Prettier --write .
npm run format:check       # Prettier --check .
```

테스트 러너는 아직 구성되어 있지 않음.

## 아키텍처

- Next.js는 14.x 라인에 고정 — 명시적 지시 없이 15/16으로 올리지 말 것 (의도적 버전 선택)
- React도 18 고정 (19 아님) — `@types/react`/`@types/react-dom`도 18.x 라인 유지
- 소스는 `src/app` 아래 (`src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`). import alias `@/*` → `src/*` (`tsconfig.json` 참고)
- Tailwind CSS v3 (`tailwind.config.ts` + `postcss.config.js` 방식), v4 아님
- `.prettierrc.json`에 `prettier-plugin-tailwindcss` 적용 — Tailwind 클래스 순서를 Prettier가 자동 정렬하므로 수동으로 순서 맞추지 말 것
- `.eslintrc.json`은 `next/core-web-vitals` 다음에 `prettier`를 확장 — 포맷 규칙은 Prettier가, 나머지는 ESLint가 담당
- `.env.example`은 필요한 환경변수 문서화용 — 실제 값은 `.env`(git-ignored)에
