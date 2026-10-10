import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  try {
    const [rows]: any = await pool.query('SELECT template_id, name, description, is_active FROM templates ORDER BY name ASC');
    return NextResponse.json({ success: true, data: rows }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { template_id, name, description } = body;
    
    if (!template_id || !name) {
      return NextResponse.json({ success: false, message: 'Template ID and Name are required' }, { status: 400, headers: corsHeaders });
    }

    // Insert or Update
    await pool.query(
      `INSERT INTO templates (template_id, name, description) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)`,
      [template_id, name, description || '']
    );

    return NextResponse.json({ success: true, message: 'Template saved successfully' }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Error saving template:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { template_id, is_active } = body;

    if (!template_id) {
      return NextResponse.json({ success: false, message: 'Template ID is required' }, { status: 400, headers: corsHeaders });
    }

    await pool.query('UPDATE templates SET is_active = ? WHERE template_id = ?', [is_active ? 1 : 0, template_id]);
    
    return NextResponse.json({ success: true, message: 'Template status updated' }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Error updating template status:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}
