import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const body = await request.json();
    
    if (typeof body.is_read !== 'undefined') {
      await pool.query('UPDATE contact_messages SET is_read = ? WHERE id = ?', [body.is_read ? 1 : 0, id]);
    }
    
    return NextResponse.json({ success: true, message: 'Message updated' }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Error updating message:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    
    await pool.query('DELETE FROM contact_messages WHERE id = ?', [id]);
    
    return NextResponse.json({ success: true, message: 'Message deleted' }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}
