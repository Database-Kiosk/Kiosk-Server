# Kiosk-Server API 명세서

- 기준 코드: `Kiosk-Server` develop `544561f` (#16 매출 통계 API 병합 시점)
- 이 문서는 **실제 구현된 코드**를 기준으로 작성했습니다. 개발 전 설계 문서(노션)와 내용이 다르면 이 문서가 우선합니다.
- 구현되지 않은 기능은 [6. 구현되지 않은 기능 및 제한 사항](#6-구현되지-않은-기능-및-제한-사항)에 따로 정리했습니다.

## 목차

1. [API 목록](#1-api-목록)
2. [공통 규칙](#2-공통-규칙)
3. [고객용 API](#3-고객용-api)
4. [관리자용 API](#4-관리자용-api)
5. [인증 및 주요 처리 규칙](#5-인증-및-주요-처리-규칙)
6. [구현되지 않은 기능 및 제한 사항](#6-구현되지-않은-기능-및-제한-사항)
7. [부록: 상태 점검 및 정적 파일 경로](#7-부록-상태-점검-및-정적-파일-경로)

---

## 1. API 목록

### 고객용 API (인증 없음)

| # | 메서드 | 경로 | 설명 |
|---|---|---|---|
| 3.1 | `GET` | `/api/tables/:tableId` | 테이블 조회 |
| 3.2 | `GET` | `/api/categories` | 카테고리 목록 조회 |
| 3.3 | `GET` | `/api/menus` | 판매 중인 메뉴 목록 조회 (옵션 포함) |
| 3.4 | `GET` | `/api/menus/:menuId/options` | 메뉴 옵션 조회 |
| 3.5 | `POST` | `/api/orders` | 주문 생성 |
| 3.6 | `GET` | `/api/tables/:tableId/orders` | 테이블의 현재 세션 주문 내역 조회 |

### 관리자용 API

| # | 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|---|
| 4.1.1 | `POST` | `/api/admin/login` | 불필요 | 로그인 |
| 4.1.2 | `POST` | `/api/admin/logout` | 불필요 | 로그아웃 |
| 4.1.3 | `GET` | `/api/admin/me` | 필요 | 로그인 상태 확인 |
| 4.2.1 | `GET` | `/api/admin/orders` | 필요 | 전체 주문 조회 (필터) |
| 4.2.2 | `GET` | `/api/admin/orders/:orderId` | 필요 | 주문 상세 조회 |
| 4.2.3 | `PATCH` | `/api/admin/orders/:orderId/status` | 필요 | 주문 상태 변경 |
| 4.3.1 | `GET` | `/api/admin/tables` | 필요 | 전체 테이블 및 현재 세션 요약 조회 |
| 4.3.2 | `GET` | `/api/admin/tables/:tableId/orders` | 필요 | 테이블의 현재 세션 주문 내역 조회 |
| 4.3.3 | `PATCH` | `/api/admin/tables/:tableId/complete` | 필요 | 테이블 이용 종료 |
| 4.4.1 | `GET` | `/api/admin/menus` | 필요 | 전체 메뉴 및 카테고리 조회 |
| 4.4.2 | `POST` | `/api/admin/menus` | 필요 | 메뉴 등록 (이미지 업로드 포함) |
| 4.4.3 | `PATCH` | `/api/admin/menus/:menuId` | 필요 | 메뉴 정보 및 기존 옵션 수정 |
| 4.4.4 | `PATCH` | `/api/admin/menus/:menuId/status` | 필요 | 메뉴 판매 상태 변경 |
| 4.5.1 | `GET` | `/api/admin/sales` | 필요 | 매출 조회 |

---

## 2. 공통 규칙

### 2.1 기본 경로

- 모든 API는 `/api` 아래에 있습니다. 로컬 개발 기본 주소는 `http://localhost:3000`입니다 (`PORT` 환경 변수로 변경).
- `/health`(상태 점검)와 `/images/menus`(메뉴 이미지)는 `/api` 밖의 경로입니다. [7. 부록](#7-부록-상태-점검-및-정적-파일-경로)을 참고하세요.

### 2.2 데이터 형식

- 요청 본문과 응답 본문은 JSON(UTF-8)입니다.
- 요청 본문이 있는 API는 `Content-Type: application/json` 헤더를 보내야 합니다. 이 헤더가 없으면 본문을 읽지 않으므로 검증 오류(400)가 됩니다.
- 예외: 메뉴 등록(`POST /api/admin/menus`)은 `multipart/form-data`를 사용합니다 (JSON도 허용).
- JSON 본문의 최대 크기는 100KB입니다. 초과하면 `413`을 응답합니다.

### 2.3 필드명 규칙

- 요청·응답 필드명은 DB 컬럼명과 같은 **snake_case**를 사용합니다. 예: `table_id`, `order_status`, `option_ids`
- 예외: 관리자 인증 API(로그인·로그인 상태 확인)의 `adminId`는 camelCase를 사용합니다.

### 2.4 값 형식

| 항목 | 형식 | 예시 |
|---|---|---|
| ID | 1 이상의 정수 | `1` |
| 금액 | 원 단위 정수 | `4500` |
| 날짜·시간 (`order_time`, `started_at`, `ended_at`) | `YYYY-MM-DD HH:mm:ss` 문자열. DB 시간대 그대로이며 시간대 표기가 없습니다. | `"2026-11-19 12:30:05"` |
| 날짜 (매출 `date`) | `YYYY-MM-DD` 문자열 | `"2026-11-19"` |
| 판매 상태 `is_active` | 숫자 `1`(판매 중) 또는 `0`(판매 중지) | `1` |
| 주문 상태 `order_status` | `"접수"` → `"조리 중"` → `"전달 완료"` | `"접수"` |
| 테이블 상태 `table_status` | `"이용 가능"` 또는 `"이용 중"` | `"이용 중"` |

### 2.5 경로 파라미터 검증

| 파라미터 | 검증 방식 |
|---|---|
| `tableId`, `orderId` | 숫자로 변환한 값이 1 이상의 안전한 정수(`Number.isSafeInteger`)여야 합니다. |
| `menuId` | `1`~`9`로 시작하는 숫자 문자열(`/^[1-9]\d*$/`)이어야 합니다. 관리자 메뉴 API는 추가로 `2147483647` 이하여야 합니다. |

검증에 실패하면 각 API의 오류 표에 적힌 `400` 메시지를 응답합니다.

### 2.6 공통 HTTP 상태 코드

| 코드 | 의미 | 발생 상황 |
|---|---|---|
| `200` | 성공 | 조회, 수정 성공 |
| `201` | 생성됨 | 주문 생성, 메뉴 등록 성공 |
| `204` | 본문 없음 | 로그아웃 성공 |
| `400` | 잘못된 요청 | 요청 값 검증 실패, 잘못된 JSON 본문, 업로드 형식 오류 |
| `401` | 인증 실패 | 관리자 쿠키 없음·만료·무효, 로그인 실패 |
| `403` | 허용되지 않은 출처 | 상태 변경 요청의 `Origin`이 `CORS_ORIGIN`과 다름 ([2.8](#28-cors-및-요청-출처-검사)) |
| `404` | 찾을 수 없음 | 존재하지 않는 테이블·메뉴·주문·카테고리, 존재하지 않는 경로 |
| `409` | 충돌 | 현재 상태에서 처리할 수 없는 요청 (판매 중지 메뉴 주문, 단계에 맞지 않는 주문 상태 변경, 이용 종료 불가 등) |
| `413` | 본문 크기 초과 | JSON 본문 100KB 초과 |
| `500` | 서버 오류 | 처리 중 예기치 않은 오류 (DB 오류 등) |

### 2.7 오류 응답 형식

모든 API 오류는 같은 형식으로 응답합니다.

```json
{ "message": "존재하지 않는 테이블입니다." }
```

| 상황 | 상태 코드 | `message` |
|---|---|---|
| JSON 본문 문법 오류 | `400` | `요청 본문 형식이 올바르지 않습니다.` |
| JSON 본문 100KB 초과 | `413` | `request entity too large` |
| 존재하지 않는 경로 | `404` | `Not Found` |
| 서버 내부 오류 | `500` | `Internal Server Error` (상세 내용은 서버 로그에만 기록) |

API별 오류 메시지는 각 API의 오류 응답 표를 참고하세요. 프론트엔드는 4xx 응답의 `message`를 화면에 그대로 표시할 수 있습니다.

### 2.8 CORS 및 요청 출처 검사

- **CORS**: `CORS_ORIGIN` 환경 변수에 지정한 출처 하나만 허용합니다 (기본값 `http://localhost:5173`). 쿠키 전송을 위해 `credentials`를 허용합니다.
- **출처 검사 (CSRF 방어)**: `/api` 아래의 `GET`, `HEAD`, `OPTIONS`가 아닌 요청은 `Origin` 헤더를 검사합니다.
  - `Origin`이 `CORS_ORIGIN`과 다르면 `403` `{ "message": "허용되지 않은 요청 출처입니다." }`
  - `Origin` 헤더가 없는 요청(curl, 서버 간 요청 등)은 통과합니다.
  - 고객용 `POST /api/orders`, 관리자 로그인·로그아웃을 포함한 모든 상태 변경 요청에 적용됩니다.
- 브라우저에서는 `CORS_ORIGIN`과 정확히 같은 주소로 접속해야 합니다. 예를 들어 `CORS_ORIGIN`이 `http://localhost:5173`이면 `http://127.0.0.1:5173`에서 보낸 요청은 차단됩니다.

---

## 3. 고객용 API

고객용 API는 인증이 필요 없습니다.

### 3.1 테이블 조회

`GET /api/tables/:tableId`

테이블이 존재하는지와 현재 상태를 조회합니다.

**경로 파라미터**

| 이름 | 타입 | 설명 |
|---|---|---|
| `tableId` | 정수 | 테이블 번호 |

**성공 응답** `200`

```json
{
  "table_id": 1,
  "table_status": "이용 가능"
}
```

**오류 응답**

| 코드 | 조건 | `message` |
|---|---|---|
| `400` | `tableId`가 1 이상의 정수가 아님 | `올바른 테이블 번호를 입력하세요.` |
| `404` | 테이블이 없음 | `존재하지 않는 테이블입니다.` |

### 3.2 카테고리 목록 조회

`GET /api/categories`

판매 중인 메뉴(`is_active = 1`)가 1개 이상 있는 카테고리만 `category_id` 오름차순으로 조회합니다.

**성공 응답** `200`

```json
[
  { "category_id": 1, "category_name": "커피" },
  { "category_id": 2, "category_name": "디저트" }
]
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `category_id` | number | 카테고리 번호 |
| `category_name` | string | 카테고리 이름 |

오류 응답은 공통 `500`만 있습니다.

### 3.3 메뉴 목록 조회

`GET /api/menus`

판매 중인 메뉴만 옵션과 함께 조회합니다. 정렬은 `category_id`, `menu_id` 오름차순이고, 옵션은 `option_id` 오름차순입니다.

**성공 응답** `200`

```json
[
  {
    "menu_id": 1,
    "menu_name": "아메리카노",
    "price": 4500,
    "category_id": 1,
    "description": "고소한 원두로 내린 커피",
    "image_url": "/images/menus/3f2b8c1e-7a4d-4e8b-9f0a-1c2d3e4f5a6b.webp",
    "is_active": 1,
    "options": [
      { "option_id": 1, "option_name": "샷 추가", "additional_price": 500 },
      { "option_id": 2, "option_name": "사이즈 업", "additional_price": 1000 }
    ]
  }
]
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `menu_id` | number | 메뉴 번호 |
| `menu_name` | string | 메뉴 이름 |
| `price` | number | 기본 가격 |
| `category_id` | number | 카테고리 번호 |
| `description` | string \| null | 설명 |
| `image_url` | string \| null | 이미지 경로. 서버 주소 기준 상대 경로(`/images/menus/{uuid}.webp`)이며, 이미지가 없으면 `null` |
| `is_active` | number | 항상 `1` |
| `options` | array | 옵션 목록. 옵션이 없으면 `[]` |
| `options[].option_id` | number | 옵션 번호 |
| `options[].option_name` | string | 옵션 이름 |
| `options[].additional_price` | number | 옵션 추가 금액 |

오류 응답은 공통 `500`만 있습니다.

### 3.4 메뉴 옵션 조회

`GET /api/menus/:menuId/options`

판매 중인 메뉴 하나의 옵션을 `option_id` 오름차순으로 조회합니다.

> 현재 프론트엔드는 이 API를 호출하지 않고, [3.3 메뉴 목록 조회](#33-메뉴-목록-조회) 응답에 포함된 `options`를 사용합니다.

**경로 파라미터**

| 이름 | 타입 | 설명 |
|---|---|---|
| `menuId` | 정수 | 메뉴 번호 |

**성공 응답** `200` (옵션이 없는 메뉴는 `[]`)

```json
[
  { "option_id": 1, "option_name": "샷 추가", "additional_price": 500 },
  { "option_id": 2, "option_name": "사이즈 업", "additional_price": 1000 }
]
```

**오류 응답**

| 코드 | 조건 | `message` |
|---|---|---|
| `400` | `menuId`가 올바른 숫자가 아님 | `올바른 메뉴 번호를 입력하세요.` |
| `404` | 메뉴가 없거나 판매 중지(`is_active = 0`) 상태 | `존재하지 않는 메뉴입니다.` |

### 3.5 주문 생성

`POST /api/orders`

테이블의 주문을 생성합니다. **가격은 요청으로 받지 않고** 서버가 DB의 메뉴·옵션 가격으로 계산합니다. 처리 규칙은 [5.3 주문 생성 처리](#53-주문-생성-처리)를 참고하세요.

**요청 본문**

```json
{
  "table_id": 1,
  "items": [
    { "menu_id": 1, "option_ids": [1, 2], "quantity": 2 },
    { "menu_id": 3, "option_ids": [], "quantity": 1 }
  ]
}
```

| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `table_id` | number | 필수 | 1 이상의 정수 |
| `items` | array | 필수 | 1개 이상 50개 이하 |
| `items[].menu_id` | number | 필수 | 1 이상의 정수 |
| `items[].option_ids` | number[] | 필수 | 옵션이 없으면 `[]`. 각 값은 1 이상의 정수, 최대 20개, 중복 불가 |
| `items[].quantity` | number | 필수 | 1 이상 99 이하의 정수 |

같은 메뉴와 옵션 조합이 여러 항목으로 와도 합치지 않고 항목별로 저장합니다.

**성공 응답** `201`

```json
{
  "order_id": 15,
  "table_id": 1,
  "order_status": "접수",
  "order_time": "2026-11-19 12:30:05",
  "total_price": 15000,
  "items": [
    {
      "menu_id": 1,
      "menu_name": "아메리카노",
      "quantity": 2,
      "unit_price": 4500,
      "options": [
        { "option_id": 1, "option_name": "샷 추가", "extra_price": 500 },
        { "option_id": 2, "option_name": "사이즈 업", "extra_price": 1000 }
      ]
    },
    {
      "menu_id": 3,
      "menu_name": "치즈케이크",
      "quantity": 1,
      "unit_price": 3000,
      "options": []
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `order_id` | number | 주문 번호 |
| `table_id` | number | 테이블 번호 |
| `order_status` | string | 항상 `"접수"` |
| `order_time` | string | 주문 시각 |
| `total_price` | number | 주문 총액 = Σ (`unit_price` + Σ `extra_price`) × `quantity` |
| `items[]` | array | 요청한 순서대로 저장된 항목 |
| `items[].menu_id`, `menu_name` | number, string | 메뉴 번호와 이름 |
| `items[].quantity` | number | 수량 |
| `items[].unit_price` | number | 주문 시점의 메뉴 기본 가격 |
| `items[].options[]` | array | 선택한 옵션 (`option_id` 오름차순) |
| `items[].options[].extra_price` | number | 주문 시점의 옵션 추가 금액 |

> 주문 생성 응답의 `items`에는 `order_detail_id`가 없습니다. 주문 내역 조회 응답에는 있습니다.

**오류 응답**

| 코드 | 조건 | `message` |
|---|---|---|
| `400` | 본문이 JSON 객체가 아님 | `요청 본문 형식이 올바르지 않습니다.` |
| `400` | `table_id`가 1 이상의 정수가 아님 | `올바른 테이블 번호를 입력하세요.` |
| `400` | `items`가 배열이 아니거나 비어 있음 | `주문할 메뉴를 하나 이상 선택하세요.` |
| `400` | `items`가 50개 초과 | `한 번에 주문할 수 있는 항목은 최대 50개입니다.` |
| `400` | 항목이 객체가 아님 | `주문 항목 형식이 올바르지 않습니다.` |
| `400` | `menu_id`가 1 이상의 정수가 아님 | `올바른 메뉴 번호를 입력하세요.` |
| `400` | `quantity`가 1~99 정수가 아님 | `수량은 1개 이상 99개 이하로 입력하세요.` |
| `400` | `option_ids`가 배열이 아니거나 값이 1 이상의 정수가 아님 | `올바른 옵션 번호를 입력하세요.` |
| `400` | 한 항목의 옵션이 20개 초과 | `메뉴 하나에 선택할 수 있는 옵션은 최대 20개입니다.` |
| `400` | 한 항목에 같은 옵션 번호 중복 | `같은 옵션을 중복으로 선택할 수 없습니다.` |
| `400` | 옵션이 없거나 해당 메뉴의 옵션이 아님 | `선택한 옵션이 해당 메뉴의 옵션이 아닙니다.` |
| `400` | 주문 총액이 `2147483647` 초과 | `주문 금액이 허용 범위를 초과했습니다.` |
| `403` | 허용되지 않은 출처 ([2.8](#28-cors-및-요청-출처-검사)) | `허용되지 않은 요청 출처입니다.` |
| `404` | 테이블이 없음 | `존재하지 않는 테이블입니다.` |
| `409` | 메뉴가 없거나 판매 중지 상태 | `주문할 수 없는 메뉴가 포함되어 있습니다. 메뉴를 다시 확인해 주세요.` |

- 4xx 오류는 모두 저장 전에 발생하며, 이때 주문은 저장되지 않습니다.
- `500`은 드물게 저장이 완료된 뒤 응답이 실패한 경우일 수도 있으므로, 클라이언트는 저장 여부가 불확실한 결과로 다루고 주문 내역을 확인해야 합니다.

### 3.6 주문 내역 조회

`GET /api/tables/:tableId/orders`

테이블의 **현재 열린 세션**의 주문만 최신순(`order_id` 내림차순)으로 조회합니다. 종료된 세션의 주문은 포함하지 않습니다. 조회만 하며 세션을 생성하지 않습니다.

**경로 파라미터**

| 이름 | 타입 | 설명 |
|---|---|---|
| `tableId` | 정수 | 테이블 번호 |

**성공 응답** `200`

```json
{
  "table_id": 1,
  "session_id": 7,
  "started_at": "2026-11-19 12:30:05",
  "total_price": 15000,
  "orders": [
    {
      "order_id": 15,
      "order_status": "조리 중",
      "order_time": "2026-11-19 12:30:05",
      "total_price": 15000,
      "items": [
        {
          "order_detail_id": 31,
          "menu_id": 1,
          "menu_name": "아메리카노",
          "quantity": 2,
          "unit_price": 4500,
          "options": [
            { "option_id": 1, "option_name": "샷 추가", "extra_price": 500 }
          ]
        }
      ]
    }
  ]
}
```

열린 세션이 없을 때:

```json
{
  "table_id": 1,
  "session_id": null,
  "started_at": null,
  "total_price": 0,
  "orders": []
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `table_id` | number | 테이블 번호 |
| `session_id` | number \| null | 현재 세션 번호. 열린 세션이 없으면 `null` |
| `started_at` | string \| null | 세션 시작 시각 |
| `total_price` | number | 현재 세션 주문들의 `total_price` 합계 |
| `orders[]` | array | 주문 목록 (최신순) |
| `orders[].order_id`, `order_status`, `order_time`, `total_price` | | 주문 정보 |
| `orders[].items[].order_detail_id` | number | 주문 항목 번호 (항목은 `order_detail_id` 오름차순) |
| `orders[].items[].menu_id`, `menu_name`, `quantity`, `unit_price` | | 항목 정보. `unit_price`는 주문 시점 가격 |
| `orders[].items[].options[]` | array | `{ option_id, option_name, extra_price }`, `extra_price`는 주문 시점 가격 |

**오류 응답**

| 코드 | 조건 | `message` |
|---|---|---|
| `400` | `tableId`가 1 이상의 정수가 아님 | `올바른 테이블 번호를 입력하세요.` |
| `404` | 테이블이 없음 | `존재하지 않는 테이블입니다.` |

---

## 4. 관리자용 API

### 관리자 API 공통 사항

- 로그인(`POST /api/admin/login`)과 로그아웃(`POST /api/admin/logout`)을 제외한 모든 관리자 API는 **로그인 쿠키(`kiosk_admin_token`)가 필요**합니다. 인증 방식은 [5.1 관리자 인증](#51-관리자-인증-jwt-및-httponly-쿠키)을 참고하세요.
- 브라우저에서는 쿠키가 전송되도록 `credentials: 'include'`로 요청해야 합니다.
- 인증에 실패하면 모든 관리자 API가 다음과 같이 응답합니다. 아래 API별 오류 표에서는 이 `401`을 생략합니다.

| 코드 | 조건 | `message` |
|---|---|---|
| `401` | 쿠키 없음 | `로그인이 필요합니다.` |
| `401` | 토큰이 만료·위조되었거나, 관리자 아이디·비밀번호가 변경됨 (쿠키도 삭제) | `로그인이 필요합니다.` |

- 상태 변경 요청(`POST`, `PATCH`)은 [2.8](#28-cors-및-요청-출처-검사)의 출처 검사로 `403`이 될 수 있습니다. 아래 오류 표에서는 이 `403`도 생략합니다.

### 4.1 인증

#### 4.1.1 로그인

`POST /api/admin/login` · 인증 불필요

**요청 본문**

```json
{
  "adminId": "admin",
  "password": "your-password"
}
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `adminId` | string | 필수 | 관리자 아이디 (빈 문자열 불가) |
| `password` | string | 필수 | 비밀번호 (빈 문자열 불가) |

**성공 응답** `200`

로그인 쿠키(`Set-Cookie: kiosk_admin_token=...`)를 설정합니다.

```json
{ "adminId": "admin" }
```

**오류 응답**

| 코드 | 조건 | `message` |
|---|---|---|
| `400` | `adminId` 또는 `password`가 없거나 빈 문자열이거나 문자열이 아님 | `아이디와 비밀번호를 입력하세요.` |
| `401` | 아이디가 없거나 비밀번호가 틀림 (두 경우를 구분하지 않음) | `아이디 또는 비밀번호가 올바르지 않습니다.` |

#### 4.1.2 로그아웃

`POST /api/admin/logout` · 인증 불필요 · 요청 본문 없음

로그인 쿠키를 삭제합니다. 로그인하지 않은 상태에서 호출해도 성공합니다.

**성공 응답** `204` (응답 본문 없음)

> 이미 발급된 토큰의 유효성은 [6.2 제한 사항](#62-제한-사항)을 참고하세요.

#### 4.1.3 로그인 상태 확인

`GET /api/admin/me` · 인증 필요

**성공 응답** `200`

```json
{ "adminId": "admin" }
```

로그인하지 않았거나 만료되었으면 `401`을 응답합니다.

### 4.2 주문

#### 4.2.1 전체 주문 조회

`GET /api/admin/orders` · 인증 필요

종료된 세션을 포함한 모든 주문을 최신순(`order_id` 내림차순)으로 조회합니다.

**쿼리 파라미터** (모두 선택, 여러 개를 보내면 AND 조건)

| 이름 | 형식 | 설명 |
|---|---|---|
| `date` | `YYYY-MM-DD` | 해당 날짜(00:00:00 이상 ~ 다음 날 00:00:00 미만)의 주문. 실제 존재하는 날짜만 허용 (`2026-02-30` 불가) |
| `status` | `접수` \| `조리 중` \| `전달 완료` | 주문 상태 |
| `table_id` | 1 이상의 정수 | 테이블 번호 |

같은 파라미터를 두 번 이상 보내면(`?status=접수&status=조리 중`) `400`입니다.

요청 예: `GET /api/admin/orders?date=2026-11-19&status=접수`

**성공 응답** `200` — 배열 (주문이 없으면 `[]`)

```json
[
  {
    "order_id": 15,
    "session_id": 7,
    "table_id": 1,
    "order_status": "접수",
    "order_time": "2026-11-19 12:30:05",
    "total_price": 15000,
    "items": [
      {
        "order_detail_id": 31,
        "menu_id": 1,
        "menu_name": "아메리카노",
        "quantity": 2,
        "unit_price": 4500,
        "options": [
          { "option_id": 1, "option_name": "샷 추가", "extra_price": 500 }
        ]
      }
    ]
  }
]
```

`items`의 형식은 [3.6 주문 내역 조회](#36-주문-내역-조회)와 같습니다. 주문마다 `session_id`, `table_id`가 추가로 포함됩니다.

**오류 응답**

| 코드 | 조건 | `message` |
|---|---|---|
| `400` | `date` 형식이 틀리거나 존재하지 않는 날짜 | `날짜는 YYYY-MM-DD 형식으로 입력하세요.` |
| `400` | `status`가 허용 값이 아님 | `주문 상태는 접수, 조리 중, 전달 완료 중 하나로 입력하세요.` |
| `400` | `table_id`가 1 이상의 정수가 아님 | `올바른 테이블 번호를 입력하세요.` |

#### 4.2.2 주문 상세 조회

`GET /api/admin/orders/:orderId` · 인증 필요

**경로 파라미터**

| 이름 | 타입 | 설명 |
|---|---|---|
| `orderId` | 정수 | 주문 번호 |

**성공 응답** `200`

```json
{
  "order_id": 15,
  "session_id": 7,
  "table_id": 1,
  "order_status": "접수",
  "order_time": "2026-11-19 12:30:05",
  "total_price": 15000,
  "session": {
    "session_id": 7,
    "started_at": "2026-11-19 12:30:05",
    "ended_at": null
  },
  "items": [
    {
      "order_detail_id": 31,
      "menu_id": 1,
      "menu_name": "아메리카노",
      "quantity": 2,
      "unit_price": 4500,
      "options": [
        { "option_id": 1, "option_name": "샷 추가", "extra_price": 500 }
      ]
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `session.session_id` | number | 주문이 속한 세션 번호 |
| `session.started_at` | string | 세션 시작 시각 |
| `session.ended_at` | string \| null | 세션 종료 시각. 이용 중이면 `null` |

나머지 필드는 [4.2.1](#421-전체-주문-조회)과 같습니다.

**오류 응답**

| 코드 | 조건 | `message` |
|---|---|---|
| `400` | `orderId`가 1 이상의 정수가 아님 | `올바른 주문 번호를 입력하세요.` |
| `404` | 주문이 없음 | `존재하지 않는 주문입니다.` |

#### 4.2.3 주문 상태 변경

`PATCH /api/admin/orders/:orderId/status` · 인증 필요

주문 상태를 **바로 다음 단계로만** 변경합니다 (`접수` → `조리 중` → `전달 완료`). 규칙은 [5.4 주문 상태 변경 제한](#54-주문-상태-변경-제한)을 참고하세요.

**요청 본문**

```json
{ "order_status": "조리 중" }
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `order_status` | string | 필수 | 변경할 상태. `조리 중` 또는 `전달 완료` (현재 상태의 다음 단계) |

**성공 응답** `200` — 변경된 주문 전체. 형식은 [4.2.2 주문 상세 조회](#422-주문-상세-조회)와 같습니다.

**오류 응답**

| 코드 | 조건 | `message` |
|---|---|---|
| `400` | `orderId`가 1 이상의 정수가 아님 | `올바른 주문 번호를 입력하세요.` |
| `400` | `order_status`가 없거나 허용 값이 아님 | `주문 상태는 접수, 조리 중, 전달 완료 중 하나로 입력하세요.` |
| `404` | 주문이 없음 | `존재하지 않는 주문입니다.` |
| `409` | 현재 상태와 같거나, 이전 단계이거나, 단계를 건너뜀 (다른 관리자가 먼저 변경한 경우 포함) | `변경할 수 없는 주문 상태입니다.` |

### 4.3 테이블

#### 4.3.1 전체 테이블 조회

`GET /api/admin/tables` · 인증 필요

모든 테이블을 `table_id` 오름차순으로 조회하고, 열린 세션이 있으면 세션 요약을 함께 응답합니다.

**성공 응답** `200`

```json
[
  {
    "table_id": 1,
    "table_status": "이용 중",
    "session": {
      "session_id": 7,
      "started_at": "2026-11-19 12:30:05",
      "order_count": 2,
      "pending_count": 1,
      "total_price": 21000
    }
  },
  {
    "table_id": 2,
    "table_status": "이용 가능",
    "session": null
  }
]
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `table_id` | number | 테이블 번호 |
| `table_status` | string | `이용 가능` \| `이용 중` |
| `session` | object \| null | 현재 열린 세션 요약. 없으면 `null` |
| `session.session_id` | number | 세션 번호 |
| `session.started_at` | string | 세션 시작 시각 |
| `session.order_count` | number | 세션의 주문 수 |
| `session.pending_count` | number | `전달 완료`가 아닌 주문 수 |
| `session.total_price` | number | 세션 주문들의 `total_price` 합계 |

오류 응답은 공통 `401`, `500`만 있습니다.

#### 4.3.2 테이블 주문 내역 조회

`GET /api/admin/tables/:tableId/orders` · 인증 필요

고객용 [3.6 주문 내역 조회](#36-주문-내역-조회)와 **같은 처리와 같은 응답 형식**입니다. 테이블의 현재 열린 세션 주문만 조회합니다.

> 종료된 세션을 포함한 테이블의 과거 주문은 [4.2.1 전체 주문 조회](#421-전체-주문-조회)의 `table_id` 필터로 조회합니다.

**오류 응답**

| 코드 | 조건 | `message` |
|---|---|---|
| `400` | `tableId`가 1 이상의 정수가 아님 | `올바른 테이블 번호를 입력하세요.` |
| `404` | 테이블이 없음 | `존재하지 않는 테이블입니다.` |

#### 4.3.3 테이블 이용 종료

`PATCH /api/admin/tables/:tableId/complete` · 인증 필요 · 요청 본문 없음

테이블의 현재 세션을 종료하고 테이블을 `이용 가능` 상태로 바꿉니다. 처리 규칙은 [5.2 테이블 세션 처리](#52-테이블-세션-처리)를 참고하세요.

**성공 응답** `200`

```json
{
  "table_id": 1,
  "table_status": "이용 가능",
  "session": null
}
```

응답 형식은 [4.3.1](#431-전체-테이블-조회) 목록의 한 항목과 같습니다.

**오류 응답** (아래 순서대로 검사)

| 코드 | 조건 | `message` |
|---|---|---|
| `400` | `tableId`가 1 이상의 정수가 아님 | `올바른 테이블 번호를 입력하세요.` |
| `404` | 테이블이 없음 | `존재하지 않는 테이블입니다.` |
| `409` | 열린 세션이 없음 | `현재 이용 중인 세션이 없습니다.` |
| `409` | 열린 세션이 2개 이상 (데이터 이상) | `활성 세션이 여러 개여서 이용을 종료할 수 없습니다.` |
| `409` | 열린 세션이 있지만 `table_status`가 `이용 중`이 아님 (데이터 이상) | `테이블 상태와 활성 세션 정보가 일치하지 않습니다.` |
| `409` | 세션에 `전달 완료`가 아닌 주문이 있음 | `처리 중인 주문이 있어 테이블 이용을 종료할 수 없습니다.` |

### 4.4 메뉴

#### 4.4.1 전체 메뉴 조회

`GET /api/admin/menus` · 인증 필요

판매 중지 메뉴를 포함한 모든 메뉴와 모든 카테고리를 조회합니다.

- `categories`: `category_id` 오름차순 (판매 중인 메뉴가 없는 카테고리도 포함)
- `menus`: `category_id`, `menu_id` 오름차순
- `options`: `option_id` 오름차순

**성공 응답** `200`

```json
{
  "categories": [
    { "category_id": 1, "category_name": "커피" },
    { "category_id": 2, "category_name": "디저트" }
  ],
  "menus": [
    {
      "menu_id": 1,
      "menu_name": "아메리카노",
      "price": 4500,
      "category_id": 1,
      "description": "고소한 원두로 내린 커피",
      "image_url": "/images/menus/3f2b8c1e-7a4d-4e8b-9f0a-1c2d3e4f5a6b.webp",
      "is_active": 1,
      "options": [
        { "option_id": 1, "option_name": "샷 추가", "additional_price": 500 }
      ]
    },
    {
      "menu_id": 2,
      "menu_name": "카페라떼",
      "price": 5000,
      "category_id": 1,
      "description": null,
      "image_url": null,
      "is_active": 0,
      "options": []
    }
  ]
}
```

메뉴 필드는 [3.3 메뉴 목록 조회](#33-메뉴-목록-조회)와 같고, `is_active`는 `0` 또는 `1`입니다.

오류 응답은 공통 `401`, `500`만 있습니다.

#### 4.4.2 메뉴 등록

`POST /api/admin/menus` · 인증 필요

메뉴와 옵션을 한 번에 등록하고, 사진을 함께 업로드할 수 있습니다. 이미지 처리는 [5.5 메뉴 이미지 업로드](#55-메뉴-이미지-업로드)를 참고하세요.

**요청 형식 1: `multipart/form-data`** (프론트엔드 사용 방식)

| 파트 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `data` | 텍스트 (JSON 문자열) | 필수 | 아래 메뉴 정보 객체를 `JSON.stringify`한 값 |
| `image` | 파일 | 선택 | JPG, PNG, WebP 사진 1장, 최대 5MB |

`data`, `image` 외의 파트를 보내거나 사진을 2장 이상 보내면 `400`입니다.

**요청 형식 2: `application/json`** — 메뉴 정보 객체를 본문으로 보냅니다. 이 경우 사진은 등록할 수 없습니다.

**메뉴 정보 객체**

```json
{
  "menu_name": "바닐라라떼",
  "price": 5500,
  "category_id": 1,
  "description": "바닐라 시럽이 들어간 라떼",
  "is_active": 1,
  "options": [
    { "option_name": "샷 추가", "additional_price": 500 },
    { "option_name": "시럽 추가" }
  ]
}
```

| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `menu_name` | string | 필수 | 앞뒤 공백 제거 후 1~100자. 공백을 제거한 값으로 저장 |
| `price` | number | 필수 | 0 이상 `2147483647` 이하의 정수 |
| `category_id` | number | 필수 | 1 이상의 정수, 존재하는 카테고리 |
| `description` | string \| null | 선택 | UTF-8 기준 65535바이트 이하. 생략하면 `null` |
| `is_active` | number | 선택 | `0` 또는 `1`. 생략하면 `1` (판매 중) |
| `options` | array | 선택 | 생략하면 옵션 없음 |
| `options[].option_name` | string | 필수 | 앞뒤 공백 제거 후 1~100자 |
| `options[].additional_price` | number | 선택 | 0 이상 `2147483647` 이하의 정수. 생략하면 `0` |

> `image_url`을 보내도 저장하지 않습니다. 이미지 경로는 서버가 저장한 사진의 경로만 사용하며, 사진이 없으면 `null`입니다. 단, `image_url`을 보내는 경우 1~255자의 문자열이어야 하며 아니면 `400`입니다.

**성공 응답** `201`

```json
{
  "menu_id": 11,
  "menu_name": "바닐라라떼",
  "price": 5500,
  "category_id": 1,
  "description": "바닐라 시럽이 들어간 라떼",
  "image_url": "/images/menus/3f2b8c1e-7a4d-4e8b-9f0a-1c2d3e4f5a6b.webp",
  "is_active": 1,
  "options": [
    { "option_id": 21, "option_name": "샷 추가", "additional_price": 500 },
    { "option_id": 22, "option_name": "시럽 추가", "additional_price": 0 }
  ]
}
```

**오류 응답**

| 코드 | 조건 | `message` |
|---|---|---|
| `400` | multipart 요청에 `data`가 없거나 올바른 JSON이 아님 | `메뉴 정보 형식이 올바르지 않습니다.` |
| `400` | JSON 요청의 본문 또는 multipart의 `data`가 JSON 객체가 아님 (배열, `null`, 숫자 등) | `요청 본문은 JSON 객체여야 합니다.` |
| `400` | `menu_name`이 1~100자 문자열이 아님 | `메뉴명은(는) 1~100자의 문자열이어야 합니다.` |
| `400` | `price`가 범위를 벗어남 | `가격은(는) 0~2147483647 범위의 정수여야 합니다.` |
| `400` | `category_id`가 범위를 벗어남 | `카테고리 번호은(는) 1~2147483647 범위의 정수여야 합니다.` |
| `400` | `is_active`가 `0`, `1`이 아님 | `판매 상태는 0 또는 1이어야 합니다.` |
| `400` | `description`이 문자열이 아니거나 너무 김 | `설명은 UTF-8 기준 65535바이트 이하의 문자열이어야 합니다.` |
| `400` | `image_url`이 1~255자 문자열이 아님 | `이미지 경로는 1~255자의 문자열이어야 합니다.` |
| `400` | `options`가 배열이 아님 | `옵션은 배열이어야 합니다.` |
| `400` | 옵션 항목이 객체가 아님 | `각 옵션은 객체여야 합니다.` |
| `400` | `option_name`이 1~100자 문자열이 아님 | `옵션명은(는) 1~100자의 문자열이어야 합니다.` |
| `400` | `additional_price`가 범위를 벗어남 | `옵션 추가금액은(는) 0~2147483647 범위의 정수여야 합니다.` |
| `400` | 사진이 5MB 초과 | `사진은 최대 5MB까지 업로드할 수 있습니다.` |
| `400` | 사진 2장 이상, 파일 필드 이름이 `image`가 아님, 텍스트 파트 2개 이상 또는 전체 파트 3개 이상, `data` 100KB 초과 | `업로드 형식이 올바르지 않습니다. 사진은 한 장만 선택해 주세요.` |
| `400` | 사진이 JPG, PNG, WebP가 아니거나 손상됨 | `정상적인 JPG, PNG, WebP 사진을 선택해 주세요.` |
| `404` | 카테고리가 없음 | `존재하지 않는 카테고리입니다.` |

#### 4.4.3 메뉴 수정

`PATCH /api/admin/menus/:menuId` · 인증 필요

메뉴 기본 정보와 **기존 옵션**을 수정합니다. 보낸 필드만 수정합니다.

**요청 본문** (JSON)

```json
{
  "menu_name": "아이스 아메리카노",
  "price": 4800,
  "description": null,
  "options": [
    { "option_id": 1, "option_name": "샷 추가", "additional_price": 600 }
  ]
}
```

| 필드 | 타입 | 제약 |
|---|---|---|
| `menu_name` | string | 앞뒤 공백 제거 후 1~100자 |
| `price` | number | 0 이상 `2147483647` 이하의 정수 |
| `category_id` | number | 1 이상의 정수, 존재하는 카테고리 |
| `description` | string \| null | `null` 또는 UTF-8 기준 65535바이트 이하 |
| `options` | array | 수정할 기존 옵션 목록 |
| `options[].option_id` | number | 필수. 이 메뉴의 옵션 번호, 중복 불가 |
| `options[].option_name` | string | 필수. 앞뒤 공백 제거 후 1~100자 |
| `options[].additional_price` | number | 필수. 0 이상 `2147483647` 이하의 정수 |

- 모든 필드는 선택이지만, 수정할 필드나 옵션이 최소 1개는 있어야 합니다.
- 위 표에 없는 필드(`is_active`, `image_url` 포함)를 보내면 `400`입니다. 판매 상태는 [4.4.4](#444-메뉴-판매-상태-변경)로 변경합니다.
- `options`에 없는 기존 옵션은 그대로 유지됩니다. 옵션 추가·삭제는 지원하지 않습니다.

**성공 응답** `200` — 수정된 메뉴와 해당 메뉴의 전체 옵션 (`option_id` 오름차순)

```json
{
  "menu_id": 1,
  "menu_name": "아이스 아메리카노",
  "price": 4800,
  "category_id": 1,
  "description": null,
  "image_url": "/images/menus/3f2b8c1e-7a4d-4e8b-9f0a-1c2d3e4f5a6b.webp",
  "is_active": 1,
  "options": [
    { "option_id": 1, "option_name": "샷 추가", "additional_price": 600 },
    { "option_id": 2, "option_name": "사이즈 업", "additional_price": 1000 }
  ]
}
```

**오류 응답**

| 코드 | 조건 | `message` |
|---|---|---|
| `400` | `menuId`가 올바른 숫자가 아님 | `올바른 메뉴 번호를 입력하세요.` |
| `400` | `menuId`가 2147483647 초과 | `메뉴 번호은(는) 1~2147483647 범위의 정수여야 합니다.` |
| `400` | 본문이 JSON 객체가 아님 | `요청 본문은 JSON 객체여야 합니다.` |
| `400` | 허용되지 않은 필드 | `수정할 수 없는 필드입니다. (필드명)` |
| `400` | 필드 값 오류 | [4.4.2](#442-메뉴-등록)의 같은 필드 메시지와 동일. 단 `description`은 `설명은 null 또는 UTF-8 기준 65535바이트 이하의 문자열이어야 합니다.` |
| `400` | `options`가 배열이 아니거나 항목이 객체가 아님 | `옵션은 배열이어야 합니다.` / `각 옵션은 객체여야 합니다.` |
| `400` | `option_id`가 1 이상의 정수가 아님 | `옵션 번호은(는) 1~2147483647 범위의 정수여야 합니다.` |
| `400` | 같은 `option_id` 중복 | `같은 옵션 번호를 두 번 보낼 수 없습니다.` |
| `400` | 수정할 필드와 옵션이 모두 없음 (`{}` 또는 `{ "options": [] }`) | `수정할 메뉴 정보 또는 옵션을 입력하세요.` |
| `400` | 옵션이 이 메뉴의 옵션이 아님 | `해당 메뉴에 속하지 않는 옵션입니다.` |
| `404` | 메뉴가 없음 | `존재하지 않는 메뉴입니다.` |
| `404` | 카테고리가 없음 | `존재하지 않는 카테고리입니다.` |

#### 4.4.4 메뉴 판매 상태 변경

`PATCH /api/admin/menus/:menuId/status` · 인증 필요

**요청 본문** — `is_active` 필드 하나만 보냅니다.

```json
{ "is_active": 0 }
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `is_active` | number | 필수 | `1`(판매 중) 또는 `0`(판매 중지). 문자열·불리언은 허용하지 않음 |

**성공 응답** `200` — [4.4.3](#443-메뉴-수정)과 같은 형식의 메뉴 전체

**오류 응답**

| 코드 | 조건 | `message` |
|---|---|---|
| `400` | `menuId`가 올바른 숫자가 아님 | `올바른 메뉴 번호를 입력하세요.` |
| `400` | `menuId`가 2147483647 초과 | `메뉴 번호은(는) 1~2147483647 범위의 정수여야 합니다.` |
| `400` | 본문이 JSON 객체가 아님 | `요청 본문은 JSON 객체여야 합니다.` |
| `400` | `is_active` 외 필드가 있거나 값이 `0`, `1`이 아님 | `판매 상태는 is_active 필드에 숫자 0 또는 1로 입력하세요.` |
| `404` | 메뉴가 없음 | `존재하지 않는 메뉴입니다.` |

### 4.5 매출

#### 4.5.1 매출 조회

`GET /api/admin/sales` · 인증 필요

기간별 매출 요약, 일별 매출, 메뉴별 매출을 조회합니다.

**쿼리 파라미터**

| 이름 | 형식 | 설명 |
|---|---|---|
| `period` | `today` \| `week` \| `month` | 최근 기간. `today`는 오늘, `week`는 오늘 포함 최근 7일, `month`는 오늘 포함 최근 30일 |
| `month` | `YYYY-MM` | 특정 월의 1일부터 말일까지 (`1000-01` ~ `9999-11`) |
| `status` | `접수` \| `조리 중` \| `전달 완료` | 선택. 해당 상태의 주문만 집계 |

- `period`와 `month`는 **둘 중 하나만** 보낼 수 있습니다. 둘 다 생략하면 `period=today`로 처리합니다.
- "오늘"은 DB 서버의 현재 날짜(`CURRENT_DATE()`)를 기준으로 합니다.
- `status`를 생략하면 모든 상태의 주문을 집계합니다.

요청 예: `GET /api/admin/sales?period=week`, `GET /api/admin/sales?month=2026-11`

**성공 응답** `200`

```json
{
  "summary": {
    "total_sales": 54000,
    "order_count": 4,
    "average_order_price": 13500,
    "quantity": 11
  },
  "daily": [
    { "date": "2026-11-19", "order_count": 3, "total_sales": 42000 },
    { "date": "2026-11-17", "order_count": 1, "total_sales": 12000 }
  ],
  "menus": [
    {
      "menu_id": 1,
      "menu_name": "아메리카노",
      "category_name": "커피",
      "quantity": 6,
      "total_sales": 30000
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `summary.total_sales` | number | 기간 내 주문 `total_price` 합계 |
| `summary.order_count` | number | 기간 내 주문 수 |
| `summary.average_order_price` | number | `total_sales / order_count`를 반올림한 값. 주문이 없으면 `0` |
| `summary.quantity` | number | 판매 수량 합계 |
| `daily[]` | array | 주문이 있는 날짜만 포함, 날짜 내림차순 (주문이 없는 날은 포함하지 않음) |
| `daily[].date` | string | `YYYY-MM-DD` |
| `daily[].order_count` | number | 해당 날짜의 주문 수 |
| `daily[].total_sales` | number | 해당 날짜의 주문 `total_price` 합계 |
| `menus[]` | array | 메뉴별 매출, `total_sales` 내림차순 (같으면 `menu_id` 오름차순) |
| `menus[].menu_id`, `menu_name`, `category_name` | number, string, string | 메뉴 정보 (현재 이름) |
| `menus[].quantity` | number | 판매 수량 |
| `menus[].total_sales` | number | Σ (`unit_price` + 옵션 `extra_price` 합계) × `quantity` (주문 시점 가격 기준) |

기간 내 주문이 없으면 `summary`의 값은 모두 `0`이고 `daily`, `menus`는 `[]`입니다.

**오류 응답**

| 코드 | 조건 | `message` |
|---|---|---|
| `400` | `period`가 허용 값이 아니거나, `month` 형식이 틀리거나, 둘을 함께 보냄 | `period(today, week, month) 또는 month(YYYY-MM) 중 하나를 입력하세요.` |
| `400` | `status`가 허용 값이 아님 | `주문 상태는 접수, 조리 중, 전달 완료 중 하나로 입력하세요.` |

---

## 5. 인증 및 주요 처리 규칙

### 5.1 관리자 인증 (JWT 및 HttpOnly 쿠키)

**로그인 쿠키**

| 항목 | 값 |
|---|---|
| 이름 | `kiosk_admin_token` |
| 내용 | JWT (HS256) |
| 유효 시간 | 8시간 (쿠키 `Max-Age`와 JWT 만료 시간 동일) |
| `HttpOnly` | 사용 (JavaScript에서 읽을 수 없음) |
| `SameSite` | `Strict` |
| `Path` | `/api` |
| `Secure` | 환경 변수 `COOKIE_SECURE=true`일 때만 사용 (HTTPS 운영 환경) |

**토큰 검증**

- JWT의 `sub`에는 관리자 아이디, `fp`에는 현재 비밀번호 해시에서 만든 지문이 들어갑니다.
- 관리자 API를 호출할 때마다 DB에서 관리자 계정을 다시 조회합니다. 따라서 **관리자 아이디나 비밀번호가 바뀌면 기존 토큰은 즉시 무효**가 됩니다.
- 토큰이 무효이면 `401`을 응답하고 쿠키를 삭제합니다.
- 서명 비밀 키는 환경 변수 `JWT_SECRET`으로 설정하며, 앞뒤 공백 없이 32자 이상이어야 합니다. 조건을 만족하지 않으면 서버가 시작되지 않습니다.

**로그인·로그아웃**

- 로그인 실패 시 아이디가 없는 경우와 비밀번호가 틀린 경우를 구분하지 않고 같은 메시지로 응답합니다. 아이디가 없을 때도 비밀번호 비교를 수행해 응답 시간을 비슷하게 맞춥니다.
- 로그아웃은 쿠키만 삭제합니다. 발급된 토큰의 유효성은 [6.2 제한 사항](#62-제한-사항)을 참고하세요.
- 관리자 계정은 API가 아닌 서버의 CLI 스크립트(`npm run admin:create`, `admin:password`, `admin:rename`)로 관리합니다.

**CSRF 방어**: `SameSite=Strict` 쿠키와 [2.8](#28-cors-및-요청-출처-검사)의 `Origin` 검사를 함께 사용합니다.

### 5.2 테이블 세션 처리

- **현재 세션**: 테이블의 `table_session` 중 `ended_at`이 `NULL`인 가장 최근 세션입니다. 주문 생성, 주문 내역 조회, 관리자 테이블 조회 모두 같은 기준을 사용합니다.
- **세션 시작**: 별도 API가 없습니다. 열린 세션이 없는 테이블에 주문이 생성되면 새 세션을 만듭니다.
- **테이블 상태**: 주문이 생성되면 기존 세션이 있는 경우에도 테이블 상태가 `이용 중`이 아니면 `이용 중`으로 맞춥니다.
- **세션 종료**: 관리자가 [4.3.3 테이블 이용 종료](#433-테이블-이용-종료)를 호출하면 하나의 트랜잭션에서 다음을 처리합니다.
  1. 테이블 행을 잠그고 존재 여부를 확인합니다.
  2. 열린 세션이 정확히 1개이고, 테이블 상태가 `이용 중`인지 확인합니다.
  3. 세션의 모든 주문이 `전달 완료`인지 확인합니다.
  4. 세션의 `ended_at`에 현재 시각을 기록하고, 테이블 상태를 `이용 가능`으로 바꿉니다.
- 세션이 종료되면 고객용 주문 내역 조회에서 이전 주문이 보이지 않습니다. 다음 주문부터 새 세션이 시작됩니다.

### 5.3 주문 생성 처리

주문 생성([3.5](#35-주문-생성))은 하나의 트랜잭션(READ COMMITTED)에서 다음 순서로 처리합니다.

1. **테이블 잠금**: 테이블 행을 `FOR UPDATE`로 잠급니다. 같은 테이블의 주문은 하나씩 순서대로 처리됩니다.
2. **메뉴·옵션 확인 및 가격 계산**: 메뉴와 옵션을 `FOR SHARE`로 읽어 판매 상태와 소속을 확인하고, DB 가격으로 금액을 계산합니다.
   - 항목 금액 = (메뉴 가격 + 선택 옵션 추가 금액 합계) × 수량
   - 주문 총액 = 항목 금액의 합계
3. **세션 확인**: 열린 세션을 사용하고, 없으면 새로 만듭니다 ([5.2](#52-테이블-세션-처리)).
4. **저장**: `orders`(상태 `접수`), `orderdetail`(항목마다 1행), `orderoption`(옵션마다 1행)을 저장합니다.
   - 주문 시점의 가격을 `orderdetail.unit_price`, `orderoption.extra_price`에 저장하므로, 이후 메뉴 가격이 바뀌어도 기존 주문 금액은 바뀌지 않습니다.

중간에 오류가 발생하면 새로 만든 세션과 테이블 상태 변경을 포함해 모두 취소됩니다.

**주문 조회 시 표시 규칙**

- 가격(`unit_price`, `extra_price`, `total_price`)은 주문 시점에 저장된 값입니다.
- 메뉴 이름과 옵션 이름은 현재 `menu`, `menu_option`의 값입니다. 판매 중지된 메뉴도 과거 주문에 표시됩니다.

### 5.4 주문 상태 변경 제한

- 주문 상태는 `접수` → `조리 중` → `전달 완료` 순서로 **한 단계씩 앞으로만** 바뀝니다.
- 같은 상태로 변경, 이전 상태로 되돌리기, 단계 건너뛰기(`접수` → `전달 완료`)는 `409`입니다.
- 변경 중에는 주문 행을 잠그므로, 두 관리자가 동시에 같은 주문을 변경하면 나중 요청은 바뀐 상태를 기준으로 검사되어 `409`를 받습니다.
- 종료된 세션의 주문도 상태 변경이 가능합니다.
- 테이블 이용 종료는 세션의 모든 주문이 `전달 완료`일 때만 가능합니다 ([5.2](#52-테이블-세션-처리)).

### 5.5 메뉴 이미지 업로드

- 메뉴 등록([4.4.2](#442-메뉴-등록)) 시 `multipart/form-data`의 `image` 파트로 사진 1장을 업로드할 수 있습니다.
- 허용 형식: JPG, PNG, WebP (파일 확장자가 아닌 실제 이미지 내용으로 확인)
- 최대 크기: 5MB, 최대 해상도: 2,500만 픽셀
- 저장 처리:
  - 사진 방향(EXIF)을 반영해 회전합니다.
  - 가로·세로 1600px 이내로 축소합니다 (더 작은 사진은 확대하지 않음).
  - WebP(품질 85)로 변환해 서버의 `public/images/menus/{UUID}.webp`에 저장합니다.
- 응답과 DB의 `image_url`은 `/images/menus/{UUID}.webp` 형식의 상대 경로입니다. 클라이언트는 API 서버 주소를 앞에 붙여 이미지를 불러옵니다.
- 메뉴 정보 검증은 사진 저장 전에 수행하며, 사진 저장 후 메뉴·옵션 저장이 실패하면 저장한 사진 파일을 삭제합니다.
- 업로드된 사진 폴더(`public/images/menus/`)는 Git에 포함하지 않습니다.

### 5.6 메뉴 판매 중지 정책

- 메뉴는 삭제하지 않고 판매 중지(`is_active = 0`)로 처리합니다. 주문 기록(`orderdetail`)이 메뉴를 외래 키로 참조하기 때문입니다.
- 판매 중지된 메뉴는 고객용 메뉴·옵션 조회에서 제외되고, 주문하면 `409`입니다.
- 판매 중인 메뉴가 하나도 없는 카테고리는 고객용 카테고리 조회에서 제외됩니다.
- 관리자 메뉴 조회에서는 판매 중지 메뉴도 표시됩니다.

---

## 6. 구현되지 않은 기능 및 제한 사항

### 6.1 구현되지 않은 기능

| 기능 | 현재 상태 |
|---|---|
| 메뉴 삭제 | API 없음. 판매 중지로 대체 |
| 기존 메뉴의 사진 변경·삭제 | API 없음. 사진은 메뉴 등록 시에만 업로드 가능 |
| 기존 메뉴의 옵션 추가·삭제 | API 없음. 메뉴 수정은 기존 옵션의 이름·금액 수정만 가능 |
| 카테고리 등록·수정·삭제 | API 없음 |
| 테이블 등록·삭제 | API 없음 |
| 주문 취소, 주문 상태 되돌리기 | API 없음. 주문 상태에 취소 값도 없음 |
| 결제 | API 없음. 프론트엔드의 결제 화면은 모의 결제 |
| 관리자 계정 관리 | API 없음. 서버 CLI 스크립트로만 관리 |

### 6.2 제한 사항

- 로그아웃은 쿠키만 삭제하며, 발급된 토큰은 만료(최대 8시간)까지 유효합니다.
- 로그인 시도 횟수 제한이 없습니다.
- 목록 조회 API에 페이지네이션이 없습니다.
- 테이블 주문 내역 API(고객용·관리자용)는 현재 세션만 조회합니다. 과거 세션 주문은 `GET /api/admin/orders?table_id=`로 조회합니다.
- 매출의 일별 목록(`daily`)에는 주문이 없는 날짜가 포함되지 않습니다.

---

## 7. 부록: 상태 점검 및 정적 파일 경로

`/api` 밖의 경로이며, 인증과 출처 검사가 적용되지 않습니다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/health` | 서버 동작 확인 |
| `GET` | `/health/db` | DB 연결 확인 |
| `GET` | `/images/menus/{파일명}` | 메뉴 이미지 파일 |

**`GET /health`** — `200`

```json
{ "status": "ok" }
```

**`GET /health/db`** — 연결 성공 `200`

```json
{
  "status": "ok",
  "database": "connected",
  "name": "kioskdb",
  "version": "8.0.36",
  "tableCount": 9
}
```

연결 실패 `503`

```json
{
  "status": "error",
  "database": "disconnected",
  "code": "ECONNREFUSED",
  "message": "MySQL 서버에 연결할 수 없습니다. MySQL 서비스가 실행 중인지, DB_HOST/DB_PORT가 올바른지 확인하세요."
}
```

**`GET /images/menus/{파일명}`** — 이미지 파일을 응답합니다 (`X-Content-Type-Options: nosniff`). 파일이 없으면 `404` `{ "message": "Not Found" }`입니다.
