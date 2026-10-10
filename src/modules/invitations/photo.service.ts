import type { UploadApiResponse } from 'cloudinary';
import { cloudinary } from '../../config/cloudinary.js';
import { env, isCloudinaryConfigured } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../common/errors/app-error.js';
import { MAX_GALLERY_PHOTOS, SINGLE_PHOTO_CATEGORIES } from '../../common/constants/statuses.js';
import type { PhotoCategory } from '../../common/constants/statuses.js';
import { groupPhotos } from './invitation.mapper.js';
import { photoRepository } from './photo.repository.js';

function uploadBuffer(buffer: Buffer, folder: string): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        // Cap very large phone photos; Cloudinary serves optimised versions anyway.
        transformation: [{ width: 2400, height: 2400, crop: 'limit' }],
      },
      (error, result) => {
        if (error || !result) reject(error ?? new Error('Empty Cloudinary response'));
        else resolve(result);
      },
    );
    stream.end(buffer);
  });
}

async function destroyRemote(publicIds: string[]): Promise<void> {
  for (let i = 0; i < publicIds.length; i += 100) {
    await cloudinary.api.delete_resources(publicIds.slice(i, i + 100), { resource_type: 'image' });
  }
}

export const photoService = {
  async list(invitationId: number) {
    return groupPhotos(await photoRepository.listForInvitation(invitationId));
  },

  /**
   * Uploads photos to Cloudinary and records them. cover / groom / bride hold
   * one photo each (a new upload replaces the old one); gallery holds up to 20.
   */
  async upload(invitationId: number, category: PhotoCategory, files: Express.Multer.File[]) {
    if (files.length === 0) {
      throw AppError.badRequest('Attach at least one image in the "photos" field', 'NO_FILES');
    }
    const isSingle = SINGLE_PHOTO_CATEGORIES.includes(category);
    if (isSingle && files.length > 1) {
      throw AppError.badRequest(`Only one ${category} photo is allowed`, 'TOO_MANY_FILES');
    }
    if (!isCloudinaryConfigured) {
      throw AppError.serviceUnavailable(
        'Image uploads are not configured on the server',
        'UPLOADS_DISABLED',
      );
    }

    const existing = await photoRepository.listByCategory(invitationId, category);
    if (!isSingle && existing.length + files.length > MAX_GALLERY_PHOTOS) {
      throw AppError.badRequest(
        `The gallery can hold at most ${MAX_GALLERY_PHOTOS} photos (${existing.length} already uploaded)`,
        'GALLERY_FULL',
      );
    }

    const folder = `${env.CLOUDINARY_FOLDER}/invitations/${invitationId}`;
    const results = await Promise.allSettled(
      files.map((file) => uploadBuffer(file.buffer, folder)),
    );
    const uploaded = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));

    if (uploaded.length !== files.length) {
      const failure = results.find((r) => r.status === 'rejected');
      logger.error({ err: failure?.reason, invitationId }, 'Cloudinary upload failed');
      this.destroyRemoteInBackground(uploaded.map((u) => u.public_id));
      throw new AppError(
        502,
        'Uploading to the image service failed, please try again',
        'UPLOAD_FAILED',
      );
    }

    const nextOrder = existing.reduce((max, photo) => Math.max(max, photo.sort_order + 1), 0);
    await photoRepository.insertMany(
      uploaded.map((result, index) => ({
        invitationId,
        category,
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width ?? null,
        height: result.height ?? null,
        bytes: result.bytes ?? null,
        sortOrder: isSingle ? 0 : nextOrder + index,
      })),
    );

    if (isSingle && existing.length > 0) {
      await photoRepository.deleteByIds(existing.map((photo) => photo.id));
      this.destroyRemoteInBackground(existing.map((photo) => photo.public_id));
    }

    return this.list(invitationId);
  },

  async remove(invitationId: number, photoId: number) {
    const photo = await photoRepository.findById(invitationId, photoId);
    if (!photo) throw AppError.notFound('Photo not found');
    await photoRepository.deleteByIds([photo.id]);
    this.destroyRemoteInBackground([photo.public_id]);
    return this.list(invitationId);
  },

  /** Sets the gallery order. photoIds must be exactly the gallery photo ids. */
  async reorderGallery(invitationId: number, photoIds: number[]) {
    const gallery = await photoRepository.listByCategory(invitationId, 'gallery');
    const galleryIds = new Set(gallery.map((photo) => photo.id));
    const sameSet =
      photoIds.length === galleryIds.size && photoIds.every((id) => galleryIds.has(id));
    if (!sameSet) {
      throw AppError.badRequest(
        'photoIds must list every gallery photo exactly once',
        'INVALID_ORDER',
      );
    }
    await photoRepository.setSortOrder(invitationId, photoIds);
    return this.list(invitationId);
  },

  publicIdsForInvitation(invitationId: number) {
    return photoRepository.publicIdsForInvitation(invitationId);
  },

  publicIdsForCustomer(customerId: number) {
    return photoRepository.publicIdsForCustomer(customerId);
  },

  /** Deleting remote files must never fail the request, so it runs detached. */
  destroyRemoteInBackground(publicIds: string[]): void {
    if (publicIds.length === 0 || !isCloudinaryConfigured) return;
    destroyRemote(publicIds).catch((err: unknown) => {
      logger.error({ err, publicIds }, 'Failed to delete images from Cloudinary');
    });
  },
};
