# ZeroQ Admin Web

ZeroQ 관리자용 Next.js 대시보드입니다. 공간/사용자/리뷰/운영 데이터를 관리하기 위한 UI를 제공합니다.

## 연결되는 백엔드
- API Gateway: `http://localhost:8080` (cloud-back-server)

## 포트
- 개발 서버: `http://localhost:3000`

## 시작하기
```bash
npm install
npm run dev
```

## 스크립트
- `npm run dev` 개발 서버 실행 (3000)
- `npm run build` 프로덕션 빌드
- `npm run start` 프로덕션 서버 실행
- `npm run lint` ESLint 실행

## 환경 변수
로컬 개발 시 `.env.local`을 생성합니다.

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## 참고
- API 요청은 Gateway(8080)를 통해 백엔드로 라우팅됩니다.
