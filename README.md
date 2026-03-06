# zeroq-front-admin

ZeroQ 관리자용 Next.js 앱입니다. 로그인/회원가입 이후 `/`에서 센서 운영 콘솔(공간 오버뷰, 센서 등록/상태변경/명령 전송)을 제공합니다.

## 현재 라우트

- `/`
- `/login`
- `/signup`

`app/api/*`와 `app/gemini-test` 디렉토리는 존재하지만, 현재 기준 `route.ts`/`page.tsx`가 없어 구현 라우트로 보지 않는 편이 안전합니다.

## 역할

- `MANAGER`, `ADMIN` 로그인과 권한 진입점
- 로그인 후 센서 운영 콘솔 진입
- 관리자 계정 회원가입 폼 제공

## 실행

```bash
npm install
npm run dev
npm run build
npm run start
npm run lint
```

## 포트

- dev: `3002`
- start: `3002`

## 환경 변수

`.env.local`

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_CLIENT_ID=zeroq-front-admin
```

## 연동 포인트

- 로그인: `/auth/login`
- 회원가입: `/api/users`
- refresh/logout: Gateway 경유 auth API 사용
- 센서 운영 API: `/api/zeroq/v1/space-sensors/**`
- API base 기본값: `http://localhost:8080`

## 참고

- 홈 화면은 공간 단위 센서 오버뷰, 센서 등록, 상태 전이, 명령 전송 기능을 포함합니다.
- 접근 권한이 `MANAGER`/`ADMIN`이 아니면 로그인 후에도 `/login?denied=1`로 되돌립니다.
