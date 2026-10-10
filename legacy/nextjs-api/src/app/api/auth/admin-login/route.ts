import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email and password are required' }, { status: 400 });
    }

    const [rows]: any = await pool.query('SELECT * FROM admins WHERE email = ?', [email]);
    
    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Invalid admin credentials' }, { status: 401 });
    }

    const admin = rows[0];
    
    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return NextResponse.json({ success: false, message: 'Invalid admin credentials' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      message: 'Admin login successful',
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
