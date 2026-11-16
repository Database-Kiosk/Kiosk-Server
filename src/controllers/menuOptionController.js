import { findMenuOptions } from '../services/menuOptionService.js';

export async function getMenuOptions(req, res) {
  const rawMenuId = req.params.menuId;
  const menuId = Number(rawMenuId);

  if (
    !/^[1-9]\d*$/.test(rawMenuId) ||
    !Number.isSafeInteger(menuId)
  ) {
    return res.status(400).json({
      message: '올바른 메뉴 번호를 입력하세요.',
    });
  }

  const options = await findMenuOptions(menuId);

  if (options === null) {
    return res.status(404).json({
      message: '존재하지 않는 메뉴입니다.',
    });
  }

  return res.status(200).json(options);
}