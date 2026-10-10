import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

function generateSlug(firstName: string, lastName: string) {
  return `${firstName.toLowerCase().trim()}-${lastName.toLowerCase().trim()}`.replace(/[^a-z0-9-]/g, '');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { firstName, lastName, phone, email, password, templateId } = body;

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate unique slug
    let baseSlug = generateSlug(firstName, lastName);
    let inviteSlug = baseSlug;
    
    let isUnique = false;
    let counter = 1;
    while (!isUnique) {
      const [rows]: any = await pool.query('SELECT id FROM users WHERE invite_slug = ?', [inviteSlug]);
      if (rows.length === 0) {
        isUnique = true;
      } else {
        inviteSlug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    // Insert user
    const [result]: any = await pool.query(
      `INSERT INTO users (first_name, last_name, phone, email, password_hash, template_id, invite_slug) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [firstName, lastName, phone, email, passwordHash, templateId || 'tpl_classic', inviteSlug]
    );

    return NextResponse.json({ 
      success: true, 
      message: 'User registered successfully!',
      userId: result.insertId,
      inviteSlug 
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error registering user:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ success: false, message: 'Email already exists' }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
export async function GET() {
  try {
    const [rows]: any = await pool.query(
      `SELECT id, first_name, last_name, email, phone, template_id, invite_slug, created_at FROM users ORDER BY created_at DESC`
    );
    return NextResponse.json({ success: true, data: rows }, { status: 200 });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
