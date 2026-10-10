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
    const guestId = params.id;
    const body = await request.json();
    
    // Currently only supporting updating 'is_sent' from the dashboard
    if (typeof body.sent !== 'undefined') {
      await pool.query('UPDATE guests SET is_sent = ? WHERE id = ?', [body.sent ? 1 : 0, guestId]);
    }
    
    return NextResponse.json({ success: true, message: 'Guest updated' }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Error updating guest:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const guestId = params.id;
    
    await pool.query('DELETE FROM guests WHERE id = ?', [guestId]);
    
    return NextResponse.json({ success: true, message: 'Guest deleted' }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Error deleting guest:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}
