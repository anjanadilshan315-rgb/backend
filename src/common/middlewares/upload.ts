import multer from 'multer';
import { AppError } from '../errors/app-error.js';

const MB = 1024 * 1024;

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_IMAGE_SIZE_MB = 5;
export const MAX_IMAGES_PER_REQUEST = 10;

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const MAX_SPREADSHEET_SIZE_MB = 2;

/** multipart field "photos" (1–10 images, 5 MB each). Files stay in memory and go to Cloudinary. */
export const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_MB * MB, files: MAX_IMAGES_PER_REQUEST },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIME_TYPES.has(file.mimetype)) cb(null, true);
    else cb(AppError.badRequest('Only JPEG, PNG and WebP images are allowed', 'INVALID_FILE_TYPE'));
  },
}).array('photos', MAX_IMAGES_PER_REQUEST);

/** multipart field "file" — one .xlsx file up to 2 MB. */
export const uploadSpreadsheet = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SPREADSHEET_SIZE_MB * MB, files: 1 },
  fileFilter: (_req, file, cb) => {
    const isXlsx = file.mimetype === XLSX_MIME || file.originalname.toLowerCase().endsWith('.xlsx');
    if (isXlsx) cb(null, true);
    else cb(AppError.badRequest('Only .xlsx Excel files are allowed', 'INVALID_FILE_TYPE'));
  },
}).single('file');
