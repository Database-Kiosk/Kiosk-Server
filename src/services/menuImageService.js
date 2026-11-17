import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const MENU_IMAGE_DIRECTORY = fileURLToPath(
  new URL('../../public/images/menus/', import.meta.url),
);

function invalidImage() {
  const error = new Error(
    '정상적인 JPG, PNG, WebP 사진을 선택해 주세요.',
  );
  error.status = 400;
  return error;
}

export async function saveMenuImage(file) {
  if (!file) return null;

  let imageBuffer;

  try {
    const image = sharp(file.buffer, {
      limitInputPixels: 25000000,
      animated: false,
    });

    const metadata = await image.metadata();

    if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
      throw invalidImage();
    }

    imageBuffer = await image
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw invalidImage();
  }

  await mkdir(MENU_IMAGE_DIRECTORY, { recursive: true });

  const filename = `${randomUUID()}.webp`;
  const filePath = path.join(MENU_IMAGE_DIRECTORY, filename);

  try {
    await writeFile(filePath, imageBuffer, { flag: 'wx' });
  } catch (error) {
    // 쓰기 도중 실패해 남은 파일도 정리
    if (error.code !== 'EEXIST') {
      await unlink(filePath).catch(() => {});
    }

    throw error;
  }

  return {
    filePath,
    imageUrl: `/images/menus/${filename}`,
  };
}

export async function removeMenuImage(filePath) {
  try {
    await unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}