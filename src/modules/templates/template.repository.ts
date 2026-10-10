import { findMany, findOne } from '../../config/database.js';

export interface TemplateRow {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  preview_image_url: string | null;
  demo_slug: string | null;
  price: number | null;
  is_active: number;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `id, code, name, description, category, preview_image_url, demo_slug, price,
                 is_active, sort_order, created_at, updated_at`;

export const templateRepository = {
  list(onlyActive: boolean) {
    return findMany<TemplateRow>(
      `SELECT ${COLUMNS} FROM templates ${onlyActive ? 'WHERE is_active = 1' : ''}
        ORDER BY sort_order, id`,
    );
  },

  findById(id: number) {
    return findOne<TemplateRow>(`SELECT ${COLUMNS} FROM templates WHERE id = ?`, [id]);
  },

  findByCode(code: string) {
    return findOne<TemplateRow>(`SELECT ${COLUMNS} FROM templates WHERE code = ?`, [code]);
  },
};
