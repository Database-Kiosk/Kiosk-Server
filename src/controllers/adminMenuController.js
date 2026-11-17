import { createMenu, findAdminMenuData } from '../services/menuService.js';
import {
  saveMenuImage,
  removeMenuImage,
} from '../services/menuImageService.js';

const MAX_INT = 2147483647;

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

// 메뉴명과 옵션명 검증
function validateName(value, label) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    [...value.trim()].length > 100
  ) {
    invalid(`${label}은(는) 1~100자의 문자열이어야 합니다.`);
  }

  return value.trim();
}

// 가격과 카테고리 번호 검증
function validateInteger(value, label, minimum = 0) {
  if (
    !Number.isInteger(value) ||
    value < minimum ||
    value > MAX_INT
  ) {
    invalid(
      `${label}은(는) ${minimum}~${MAX_INT} 범위의 정수여야 합니다.`,
    );
  }

  return value;
}

function validateMenuInput(body) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    invalid('요청 본문은 JSON 객체여야 합니다.');
  }

  const menu_name = validateName(body.menu_name, '메뉴명');
  const price = validateInteger(body.price, '가격');
  const category_id = validateInteger(
    body.category_id,
    '카테고리 번호',
    1,
  );

  // 판매 상태를 생략하면 판매 중으로 등록
  const is_active =
    body.is_active === undefined ? 1 : body.is_active;

  if (is_active !== 0 && is_active !== 1) {
    invalid('판매 상태는 0 또는 1이어야 합니다.');
  }

  const description = body.description ?? null;

  if (
    description !== null &&
    (
      typeof description !== 'string' ||
      Buffer.byteLength(description, 'utf8') > 65535
    )
  ) {
    invalid(
      '설명은 UTF-8 기준 65535바이트 이하의 문자열이어야 합니다.',
    );
  }

  const image_url = body.image_url ?? null;

  if (
    image_url !== null &&
    (
      typeof image_url !== 'string' ||
      !image_url.trim() ||
      [...image_url].length > 255
    )
  ) {
    invalid('이미지 경로는 1~255자의 문자열이어야 합니다.');
  }

  // 옵션을 생략하면 옵션 없는 메뉴로 등록
  const rawOptions =
    body.options === undefined ? [] : body.options;

  if (!Array.isArray(rawOptions)) {
    invalid('옵션은 배열이어야 합니다.');
  }

  const options = rawOptions.map((option) => {
    if (
      !option ||
      typeof option !== 'object' ||
      Array.isArray(option)
    ) {
      invalid('각 옵션은 객체여야 합니다.');
    }

    return {
      option_name: validateName(option.option_name, '옵션명'),
      additional_price: validateInteger(
        option.additional_price === undefined
          ? 0
          : option.additional_price,
        '옵션 추가금액',
      ),
    };
  });

  return {
    menu_name,
    price,
    category_id,
    description,
    image_url,
    is_active,
    options,
  };
}

export async function postAdminMenu(req, res) {
  let body;

  if (req.is('multipart/form-data')) {
    try {
      if (typeof req.body?.data !== 'string') {
        throw new Error('Missing data');
      }

      body = JSON.parse(req.body.data);
    } catch {
      const error = new Error('메뉴 정보 형식이 올바르지 않습니다.');
      error.status = 400;
      throw error;
    }
  } else {
    // 기존 JSON 요청도 사용할 수 있도록 유지
    body = req.body;
  }

  const menuData = validateMenuInput(body);

  // 이미지 주소는 서버에서 저장한 결과만 사용
  menuData.image_url = null;

  let savedImage = null;
  let savedMenu;

  try {
    savedImage = await saveMenuImage(req.file);

    if (savedImage) {
      menuData.image_url = savedImage.imageUrl;
    }

    savedMenu = await createMenu(menuData);
  } catch (error) {
    // 메뉴 또는 옵션 저장에 실패하면 사진도 삭제
    if (savedImage) {
      try {
        await removeMenuImage(savedImage.filePath);
      } catch (cleanupError) {
        console.error('메뉴 이미지 삭제 실패:', cleanupError);
      }
    }

    throw error;
  }

  res.status(201).json(savedMenu);
}

export async function getAdminMenus(req, res) {
  const data = await findAdminMenuData();

  res.json(data);
}