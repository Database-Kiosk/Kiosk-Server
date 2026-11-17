import pool from '../config/db.js';

// Customer menus: only menus on sale (is_active = 1), each with its options.
// Options are loaded in one query (not per menu) and grouped by menu_id.
export async function findActiveMenus() {
  const [menus] = await pool.execute(
    `SELECT menu_id, menu_name, price, category_id, description, image_url, is_active
     FROM menu
     WHERE is_active = 1
     ORDER BY category_id, menu_id`,
  );

  const [options] = await pool.execute(
    `SELECT o.option_id, o.menu_id, o.option_name, o.additional_price
     FROM menu_option o
     JOIN menu m ON m.menu_id = o.menu_id
     WHERE m.is_active = 1
     ORDER BY o.option_id`,
  );

  const optionsByMenuId = new Map();
  for (const { menu_id: menuId, ...option } of options) {
    if (!optionsByMenuId.has(menuId)) optionsByMenuId.set(menuId, []);
    optionsByMenuId.get(menuId).push(option);
  }

  return menus.map((menu) => ({ ...menu, options: optionsByMenuId.get(menu.menu_id) ?? [] }));
}

// 메뉴와 옵션을 하나의 트랜잭션으로 저장
export async function createMenu(menu) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 카테고리가 실제로 존재하는지 확인
    const [categories] = await connection.execute(
      `SELECT category_id
       FROM category
       WHERE category_id = ?
       FOR SHARE`,
      [menu.category_id],
    );

    if (categories.length === 0) {
      const error = new Error('존재하지 않는 카테고리입니다.');
      error.status = 404;
      throw error;
    }

    const {
      menu_name,
      price,
      category_id,
      description,
      image_url,
      is_active,
    } = menu;

    // 메뉴 기본 정보 저장
    const [result] = await connection.execute(
      `INSERT INTO menu (
        menu_name,
        price,
        category_id,
        description,
        image_url,
        is_active
      )
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        menu_name,
        price,
        category_id,
        description,
        image_url,
        is_active,
      ],
    );

    const menuId = result.insertId;
    const options = [];

    // 생성된 menu_id에 옵션 연결
    for (const option of menu.options) {
      const [optionResult] = await connection.execute(
        `INSERT INTO menu_option (
          menu_id,
          option_name,
          additional_price
        )
        VALUES (?, ?, ?)`,
        [
          menuId,
          option.option_name,
          option.additional_price,
        ],
      );

      options.push({
        option_id: optionResult.insertId,
        option_name: option.option_name,
        additional_price: option.additional_price,
      });
    }

    // 메뉴와 옵션 저장이 모두 성공한 경우 확정
    await connection.commit();

    return {
      menu_id: menuId,
      menu_name,
      price,
      category_id,
      description,
      image_url,
      is_active,
      options,
    };
  } catch (error) {
    // 중간에 실패하면 메뉴와 옵션 저장을 모두 취소
    try {
      await connection.rollback();
    } catch {
      // 롤백에 실패해도 최초 오류를 유지
    }

    throw error;
  } finally {
    connection.release();
  }
}
export async function findAdminMenuData() {
  const [categories] = await pool.execute(
    `SELECT category_id, category_name
     FROM category
     ORDER BY category_id`,
  );

  const [menus] = await pool.execute(
    `SELECT menu_id, menu_name, price, category_id,
            description, image_url, is_active
     FROM menu
     ORDER BY category_id, menu_id`,
  );

  const [options] = await pool.execute(
    `SELECT option_id, menu_id, option_name, additional_price
     FROM menu_option
     ORDER BY option_id`,
  );

  const optionsByMenuId = new Map();

  for (const { menu_id, ...option } of options) {
    if (!optionsByMenuId.has(menu_id)) {
      optionsByMenuId.set(menu_id, []);
    }

    optionsByMenuId.get(menu_id).push(option);
  }

  return {
    categories,
    menus: menus.map((menu) => ({
      ...menu,
      options: optionsByMenuId.get(menu.menu_id) ?? [],
    })),
  };
}
