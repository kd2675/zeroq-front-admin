# zeroq-front-admin

ZeroQ 관리자용 Next.js 앱입니다. 로그인/회원가입 이후 점유율 운영을 위한 7개 메뉴 콘솔과 상세 하위 페이지를 제공합니다.

## 현재 라우트

- `/`
- `/areas`
- `/areas/[spaceId]`
- `/sensors`
- `/sensors/[sensorId]`
- `/gateways`
- `/gateways/[gatewayId]`
- `/analytics`
- `/settings`
- `/logs`
- `/login`
- `/signup`
- `/space-layout` (`/areas` 호환 리다이렉트)

`app/api/*`와 `app/gemini-test` 디렉토리는 존재하지만, 현재 기준 `route.ts`/`page.tsx`가 없어 구현 라우트로 보지 않는 편이 안전합니다.

## 역할

- `MANAGER`, `ADMIN` 로그인과 권한 진입점
- 로그인 후 관리자 운영 콘솔 진입
- 대시보드, 영역, 센서, 게이트웨이, 분석, 설정, 로그 메뉴 제공
- 공간 상세/센서 상세/게이트웨이 상세 하위 페이지 제공
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
NEXT_PUBLIC_ADMIN_API_URL=http://localhost:8080
NEXT_PUBLIC_CLIENT_ID=zeroq-front-admin
```

## 연동 포인트

- 로그인: `/auth/login`
- 회원가입: `/api/users`
- refresh/logout: Gateway 경유 auth API 사용
- 공간/점유율 API: `/api/zeroq/v1/spaces`, `/api/zeroq/v1/occupancy/**`
- 센서 운영 API: `/api/zeroq/v1/space-sensors/**`
- 일반 API base 기본값: `http://localhost:8080` (`NEXT_PUBLIC_API_URL`)
- 관리자 API base 기본값: `NEXT_PUBLIC_ADMIN_API_URL` 미설정 시 `NEXT_PUBLIC_API_URL` 사용

## 참고

- Dashboard/Area/Sensor/Analytics 화면은 `spaces`, `occupancy`, `space-sensors` API를 우선 사용하고, gateway/log/settings는 운영 파생 데이터 뷰를 함께 사용합니다.
- Sensor List 화면은 기존 센서 등록, 상태 변경, 명령 전송 액션을 유지합니다.
- 직접 로그인하거나 세션 만료 후 다시 로그인해도 저장된 pending path로 복귀합니다.
- 접근 권한이 `MANAGER`/`ADMIN`이 아니면 로그인 후에도 `/login?denied=1`로 되돌립니다.
