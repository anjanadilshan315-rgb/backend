import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = params.id;
    const body = await request.json();
    const { currentPassword, newPassword, isAdmin } = body;

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ success: false, message: 'New password must be at least 6 characters' }, { status: 400, headers: corsHeaders });
    }

    const [userRows]: any = await pool.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404, headers: corsHeaders });
    }

    const user = userRows[0];

    // If it's a regular user update, require current password
    if (!isAdmin) {
      if (!currentPassword) {
        return NextResponse.json({ success: false, message: 'Current password is required' }, { status: 400, headers: corsHeaders });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        return NextResponse.json({ success: false, message: 'Incorrect current password' }, { status: 401, headers: corsHeaders });
      }
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);

    return NextResponse.json({ success: true, message: 'Password updated successfully' }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Error updating password:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}

