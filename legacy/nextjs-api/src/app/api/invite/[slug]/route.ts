import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  try {
    const slug = params.slug;
    
    // 1. Fetch user by slug to get their ID and template_id
    const [userRows]: any = await pool.query(
      'SELECT id, first_name, last_name, template_id, invite_slug FROM users WHERE invite_slug = ?', 
      [slug]
    );
    
    if (userRows.length === 0) {
      return NextResponse.json({ success: false, message: 'Invitation not found' }, { status: 404, headers: corsHeaders });
    }
    
    const user = userRows[0];
    
    // 2. Fetch event details for this user
    const [eventRows]: any = await pool.query('SELECT * FROM event_details WHERE user_id = ?', [user.id]);
    
    let eventDetails = null;
    if (eventRows.length > 0) {
      eventDetails = eventRows[0];
      
      // Parse JSON fields
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
        template_id: user.template_id,
        first_name: user.first_name,
        last_name: user.last_name,
        event: eventDetails
      }
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Error fetching invitation:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}
