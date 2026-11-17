import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 1,
    fieldSize: 100 * 1024,
    parts: 2,
  },
});

export default function uploadMenuImage(req, res, next) {
  upload.single('image')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      const message =
        error.code === 'LIMIT_FILE_SIZE'
          ? '사진은 최대 5MB까지 업로드할 수 있습니다.'
          : '업로드 형식이 올바르지 않습니다. 사진은 한 장만 선택해 주세요.';

      res.status(400).json({ message });
      return;
    }

    next(error);
  });
}