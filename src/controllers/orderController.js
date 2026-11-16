import { createOrder } from '../services/orderService.js';

const MAX_ITEMS = 50;
const MAX_QUANTITY = 99;
const MAX_OPTIONS_PER_ITEM = 20;

const isPositiveId = (value) => Number.isSafeInteger(value) && value > 0;

// Returns an error message for an invalid request body, or null if the shape is valid.
// Prices are never read from the request; the server computes them from the DB.
function validateOrderBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return '요청 본문 형식이 올바르지 않습니다.';
  }

  const { table_id: tableId, items } = body;

  if (!isPositiveId(tableId)) {
    return '올바른 테이블 번호를 입력하세요.';
  }
  if (!Array.isArray(items) || items.length === 0) {
    return '주문할 메뉴를 하나 이상 선택하세요.';
  }
  if (items.length > MAX_ITEMS) {
    return `한 번에 주문할 수 있는 항목은 최대 ${MAX_ITEMS}개입니다.`;
  }

  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return '주문 항목 형식이 올바르지 않습니다.';
    }
    if (!isPositiveId(item.menu_id)) {
      return '올바른 메뉴 번호를 입력하세요.';
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) {
      return `수량은 1개 이상 ${MAX_QUANTITY}개 이하로 입력하세요.`;
    }
    if (!Array.isArray(item.option_ids) || !item.option_ids.every(isPositiveId)) {
      return '올바른 옵션 번호를 입력하세요.';
    }
    if (item.option_ids.length > MAX_OPTIONS_PER_ITEM) {
      return `메뉴 하나에 선택할 수 있는 옵션은 최대 ${MAX_OPTIONS_PER_ITEM}개입니다.`;
    }
    if (new Set(item.option_ids).size !== item.option_ids.length) {
      return '같은 옵션을 중복으로 선택할 수 없습니다.';
    }
  }

  return null;
}

export async function postOrder(req, res) {
  const errorMessage = validateOrderBody(req.body);
  if (errorMessage) {
    res.status(400).json({ message: errorMessage });
    return;
  }

  const { table_id: tableId, items } = req.body;
  const order = await createOrder({
    tableId,
    items: items.map((item) => ({
      menuId: item.menu_id,
      optionIds: item.option_ids,
      quantity: item.quantity,
    })),
  });

  res.status(201).json(order);
}
