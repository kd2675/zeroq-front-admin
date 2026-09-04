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
- `/auth/callback`
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
NEXT_PUBLIC_API_MODE=direct
NEXT_PUBLIC_ZEROQ_API_URL=http://localhost:20180
NEXT_PUBLIC_AUTH_API_URL=http://localhost:9000
NEXT_PUBLIC_CLIENT_ID=zeroq-front-admin
```

Cloud Gateway/Eureka 경유로 실행할 때는 다음처럼 전환합니다.

```bash
NEXT_PUBLIC_API_MODE=gateway
NEXT_PUBLIC_API_URL=http://localhost:8080
```

`NEXT_PUBLIC_ADMIN_API_URL`은 관리자 API만 별도 주소로 분리해야 하는 환경에서 사용할 수 있으며, 미설정 시 ZeroQ API base를 사용합니다.

## 연동 포인트

- 로그인: `/auth/login`
- 회원가입: `/api/users`
- OAuth authorize: `/oauth2/authorize/naver-zeroq-admin`, `/oauth2/authorize/kakao-zeroq-admin`
- 로그인/회원가입/refresh/logout: direct 기본값은 `http://localhost:9000`, gateway 모드는 `NEXT_PUBLIC_API_URL` 사용
- OAuth callback: URL 토큰 없이 HttpOnly refresh cookie로 세션 복구
- 공간/점유율 API: `/api/zeroq/v1/spaces`, `/api/zeroq/v1/occupancy/**`
- 센서 운영 API: `/api/zeroq/v1/space-sensors/**`
- 기본 실행 모드: `direct`
- ZeroQ API base: `NEXT_PUBLIC_ZEROQ_API_URL` 기본값 `http://localhost:20180`
- Auth/OAuth base: `NEXT_PUBLIC_AUTH_API_URL` 기본값 `http://localhost:9000`
- 관리자 API base: `NEXT_PUBLIC_ADMIN_API_URL` 미설정 시 ZeroQ API base 사용

## 참고

- Dashboard/Area/Sensor/Analytics 화면은 `spaces`, `occupancy`, `space-sensors` API를 우선 사용하고, gateway/log/settings는 운영 파생 데이터 뷰를 함께 사용합니다.
- Dashboard의 24시간 차트는 최근 이벤트를 추세처럼 재구성하지 않고 `space-sensors/spaces/{spaceId}/usage`의 실측 bucket과 coverage를 사용합니다.
- 보고 센서가 없을 때 전체 점유율과 최대값은 `확인 불가`로 표시합니다. 내보내기·기간·구역 필터처럼 동작이 연결되지 않은 제어는 화면에 노출하지 않습니다.
- Analytics의 시간대별 사용률은 화면에서 선택한 한 공간의 실측값이며, 전체 공간 현재값과 구분해 표시합니다.
- 현재 API에는 도면 좌표 계약이 없으므로 공간 상세는 평면 배치를 추정하지 않고 서버에 등록된 `positionCode`/위치 문자열만 표시합니다.
- Settings의 임계치·보관 기간·알림 채널은 현재 DB에 선호값만 저장합니다. 실제 alert 계산, retention 삭제 작업, email/push/SMS 발송에는 아직 연결되지 않았고 화면에도 이 한계를 표시합니다.
- Sensor List 화면은 기존 센서 등록, 상태 변경, 명령 전송 액션을 유지합니다.
- 직접 로그인, OAuth 로그인, 세션 만료 후 재로그인 모두 검증된 `next` 내부 경로로 복귀합니다.
- 접근 권한이 `MANAGER`/`ADMIN`이 아니면 로그인 후에도 `/login?denied=1`로 되돌립니다.
- `local-direct`는 로컬 개발 편의를 위한 모드입니다. ZeroQ 서버는 loopback에만 바인딩하고, 프론트가 access token claim에서 `X-User-*` 헤더를 구성하므로 외부에 노출하는 환경에서는 반드시 Gateway 모드를 사용합니다.
