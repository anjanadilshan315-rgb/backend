import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = params.id;
    
    // Fetch user details
    const [userRows]: any = await pool.query('SELECT id, first_name, last_name, phone, email, template_id, invite_slug, created_at FROM users WHERE id = ?', [userId]);
    
    if (userRows.length === 0) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404, headers: corsHeaders });
    }
    
    // Fetch event details
    const [eventRows]: any = await pool.query('SELECT * FROM event_details WHERE user_id = ?', [userId]);
    
    let eventDetails = null;
    if (eventRows.length > 0) {
      eventDetails = eventRows[0];
      try {
        eventDetails.events_schedule = typeof eventDetails.events_schedule === 'string' ? JSON.parse(eventDetails.events_schedule) : eventDetails.events_schedule;
      } catch (e) {
        eventDetails.events_schedule = [];
      }
      try {
        eventDetails.photo_gallery = typeof eventDetails.photo_gallery === 'string' ? JSON.parse(eventDetails.photo_gallery) : eventDetails.photo_gallery;
      } catch (e) {
        eventDetails.photo_gallery = [];
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: {
        user: userRows[0],
        event: eventDetails
      }
    }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Error fetching specific user:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = params.id;
    const body = await request.json();
    
    // Support either { user: {...}, event: {...} } or backward compatible flat user object
    const userData = body.user || body;
    const eventData = body.event || null;

    const { first_name, last_name, phone, template_id, invite_slug } = userData;

    // Update user
    await pool.query(
      'UPDATE users SET first_name = ?, last_name = ?, phone = ?, template_id = ?, invite_slug = ? WHERE id = ?',
      [first_name, last_name, phone, template_id, invite_slug, userId]
    );

    // Update event if provided
    if (eventData) {
      // Check if event exists
      const [existingRows]: any = await pool.query('SELECT user_id FROM event_details WHERE user_id = ?', [userId]);
      
      const { 
        bride_name, groom_name, bride_phone, groom_phone,
        wedding_date, rsvp_deadline, venue_name, venue_address,
        whatsapp_greeting, events_schedule, photo_gallery 
      } = eventData;
      
      const eventsJson = typeof events_schedule === 'string' ? events_schedule : JSON.stringify(events_schedule || []);
      const galleryJson = typeof photo_gallery === 'string' ? photo_gallery : JSON.stringify(photo_gallery || []);
      
      if (existingRows.length > 0) {
        // Update
        await pool.query(
          `UPDATE event_details SET 
            bride_name = ?, groom_name = ?, bride_phone = ?, groom_phone = ?,
            wedding_date = ?, venue_name = ?, venue_address = ?, rsvp_deadline = ?,
            whatsapp_greeting = ?, events_schedule = ?, photo_gallery = ?
           WHERE user_id = ?`,
          [
            bride_name || null, groom_name || null, bride_phone || null, groom_phone || null,
            wedding_date || null, venue_name || null, venue_address || null, rsvp_deadline || null,
            whatsapp_greeting || null, eventsJson, galleryJson,
            userId
          ]
        );
      } else {
        // Insert
        await pool.query(
          `INSERT INTO event_details (
            user_id, bride_name, groom_name, bride_phone, groom_phone,
            wedding_date, venue_name, venue_address, rsvp_deadline,
            whatsapp_greeting, events_schedule, photo_gallery
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId, bride_name || null, groom_name || null, bride_phone || null, groom_phone || null,
            wedding_date || null, venue_name || null, venue_address || null, rsvp_deadline || null,
            whatsapp_greeting || null, eventsJson, galleryJson
          ]
        );
      }
    }

    return NextResponse.json({ success: true, message: 'User updated successfully' }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}
