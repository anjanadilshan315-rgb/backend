import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      userId, 
      brideName, groomName, bridePhone, groomPhone,
      weddingDate, rsvpDeadline, venueName, venueAddress,
      whatsappGreeting, eventsSchedule, photoGallery 
    } = body;

    if (!userId) {
      return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400, headers: corsHeaders });
    }

    // Convert arrays to JSON strings for database insertion
    const eventsJson = JSON.stringify(eventsSchedule || []);
    const galleryJson = JSON.stringify(photoGallery || []);

    // Insert or update event details
    // We use INSERT ... ON DUPLICATE KEY UPDATE so they can edit their details multiple times
    const query = `
      INSERT INTO event_details (
        user_id, bride_name, groom_name, bride_phone, groom_phone,
        wedding_date, rsvp_deadline, venue_name, venue_address,
        whatsapp_greeting, events_schedule, photo_gallery
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        bride_name=VALUES(bride_name), groom_name=VALUES(groom_name),
        bride_phone=VALUES(bride_phone), groom_phone=VALUES(groom_phone),
        wedding_date=VALUES(wedding_date), rsvp_deadline=VALUES(rsvp_deadline),
        venue_name=VALUES(venue_name), venue_address=VALUES(venue_address),
        whatsapp_greeting=VALUES(whatsapp_greeting),
        events_schedule=VALUES(events_schedule), photo_gallery=VALUES(photo_gallery)
    `;

    await pool.query(query, [
      userId, brideName, groomName, bridePhone, groomPhone,
      weddingDate || null, rsvpDeadline || null, venueName, venueAddress,
      whatsappGreeting, eventsJson, galleryJson
    ]);

    return NextResponse.json({ success: true, message: 'Wedding details saved successfully!' }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Error saving event details:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400, headers: corsHeaders });
    }

    const [rows]: any = await pool.query('SELECT * FROM event_details WHERE user_id = ?', [userId]);

    if (rows.length === 0) {
      return NextResponse.json({ success: true, data: null }, { headers: corsHeaders });
    }

    // Parse JSON fields
    const data = rows[0];
    try {
      data.events_schedule = typeof data.events_schedule === 'string' ? JSON.parse(data.events_schedule) : data.events_schedule;
    } catch (e) {
      data.events_schedule = [];
    }
    try {
      data.photo_gallery = typeof data.photo_gallery === 'string' ? JSON.parse(data.photo_gallery) : data.photo_gallery;
    } catch (e) {
      data.photo_gallery = [];
    }

    return NextResponse.json({ success: true, data }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Error fetching event details:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}
