import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400, headers: corsHeaders });
    }

    const [rows]: any = await pool.query(
      'SELECT id, guest_name as name, guest_phone as phone, is_sent as sent, rsvp_status as rsvp, head_count as headcount, wishes_message as wish FROM guests WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    // Convert tinyint to boolean for the frontend
    const formattedRows = rows.map((r: any) => ({
      ...r,
      sent: r.sent === 1
    }));

    return NextResponse.json({ success: true, data: formattedRows }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Error fetching guests:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, name, phone } = body;

    if (!userId || !name) {
      return NextResponse.json({ success: false, message: 'User ID and Guest Name are required' }, { status: 400, headers: corsHeaders });
    }

    const [result]: any = await pool.query(
      'INSERT INTO guests (user_id, guest_name, guest_phone, rsvp_status, head_count, is_sent) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, name, phone || null, 'pending', 0, 0]
    );

    return NextResponse.json({ 
      success: true, 
      data: {
        id: result.insertId,
        name,
        phone,
        sent: false,
        rsvp: 'pending',
        headcount: 0,
        wish: ''
      }
    }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Error adding guest:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}
