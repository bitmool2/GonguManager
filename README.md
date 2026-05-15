# 공구매니저 (GonguManager)

인스타그램 공동구매 셀러 및 소규모 온라인 셀러를 위한 B2B SaaS 주문 관리 플랫폼

## 주요 기능

- **주문관리** - 주문 리스트, 검색, 필터, 상태 변경
- **입금관리** - 입금 매칭, CSV/Excel 업로드, 수동 매칭
- **배송관리** - 송장 등록, 배송 상태 관리
- **주문폼 생성** - 공개 주문 URL 생성
- **대시보드** - KPI 카드, 최근 주문, 알림

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | NestJS, TypeScript |
| Database | MySQL 8 |
| ORM | Prisma |
| Auth | JWT, Google OAuth |

## 프로젝트 구조

```
GonguManager/
├── frontend/          # Next.js 프론트엔드
│   ├── src/
│   │   ├── app/       # App Router 페이지
│   │   ├── components/ # UI 컴포넌트
│   │   └── lib/       # 유틸리티
│   └── package.json
├── backend/           # NestJS 백엔드
│   ├── src/
│   │   ├── auth/      # 인증 모듈
│   │   ├── orders/    # 주문 모듈
│   │   ├── payments/  # 입금 모듈
│   │   ├── shipments/ # 배송 모듈
│   │   ├── products/  # 상품 모듈
│   │   ├── faqs/      # FAQ 모듈
│   │   ├── settings/  # 설정 모듈
│   │   └── prisma/    # Prisma 서비스
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── package.json
├── docker-compose.yml
└── init.sql
```

## 시작하기

### 1. MySQL 데이터베이스 실행

```bash
docker-compose up -d
```

### 2. Backend 설정 및 실행

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

백엔드 서버: http://localhost:4000
API 문서: http://localhost:4000/api

### 3. Frontend 실행

```bash
cd frontend
npm install
npm run dev
```

프론트엔드: http://localhost:3000

## 시드 데이터 계정

- **이메일**: seller@example.com
- **비밀번호**: password123

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| POST | /auth/register | 회원가입 |
| POST | /auth/login | 로그인 |
| POST | /auth/google | Google 로그인 |
| GET | /orders | 주문 목록 |
| GET | /orders/dashboard | 대시보드 통계 |
| GET | /orders/recent | 최근 주문 |
| GET | /orders/:id | 주문 상세 |
| PUT | /orders/:id/status | 주문 상태 변경 |
| POST | /public/orders/:slug | 공개 주문 생성 |
| GET | /products | 상품 목록 |
| GET | /products/public/:slug | 공개 상품 목록 |
| POST | /products | 상품 등록 |
| GET | /payments | 입금 목록 |
| GET | /payments/summary | 입금 요약 |
| PUT | /payments/:id/confirm | 입금 확인 |
| PUT | /payments/:id/match | 수동 매칭 |
| POST | /payments/upload | 입금내역 업로드 |
| GET | /shipments | 배송 목록 |
| GET | /shipments/summary | 배송 요약 |
| PUT | /shipments/:id/tracking | 송장 등록 |
| PUT | /shipments/:id/status | 배송 상태 변경 |
| GET | /settings | 설정 조회 |
| PUT | /settings | 설정 저장 |
| GET | /faqs | FAQ 목록 |
| POST | /faqs | FAQ 생성 |
| PUT | /faqs/:id | FAQ 수정 |
| DELETE | /faqs/:id | FAQ 삭제 |

## 환경 변수

### Backend (.env)
```
DATABASE_URL="mysql://gongu:gongu1234@localhost:3306/gongu_manager"
JWT_SECRET="your-jwt-secret"
JWT_EXPIRES_IN="7d"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
FRONTEND_URL="http://localhost:3000"
PORT=4000
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```
