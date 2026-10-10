import cloudinaryPackage from 'cloudinary';
import { env, isCloudinaryConfigured } from './env.js';

export const cloudinary = cloudinaryPackage.v2;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}
