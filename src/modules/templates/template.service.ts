import { AppError } from '../../common/errors/app-error.js';
import { templateRepository } from './template.repository.js';
import type { TemplateRow } from './template.repository.js';

export function toTemplateDto(row: TemplateRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    category: row.category,
    previewImageUrl: row.preview_image_url,
    demoSlug: row.demo_slug,
    price: row.price,
    isActive: Boolean(row.is_active),
    sortOrder: row.sort_order,
  };
}

export const templateService = {
  async list(onlyActive: boolean) {
    return (await templateRepository.list(onlyActive)).map(toTemplateDto);
  },

  /** Accepts the numeric id or the code (e.g. "tpl_classic"). */
  async getPublic(idOrCode: string) {
    const row = /^\d+$/.test(idOrCode)
      ? await templateRepository.findById(Number(idOrCode))
      : await templateRepository.findByCode(idOrCode);
    if (!row || !row.is_active) throw AppError.notFound('Template not found');
    return toTemplateDto(row);
  },

  /** Used when a customer picks a template. */
  async assertSelectable(templateId: number): Promise<TemplateRow> {
    const row = await templateRepository.findById(templateId);
    if (!row || !row.is_active) {
      throw AppError.badRequest('Selected template is not available', 'TEMPLATE_UNAVAILABLE');
    }
    return row;
  },
};
