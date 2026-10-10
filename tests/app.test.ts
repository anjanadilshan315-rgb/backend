import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/common/utils/jwt.js';
import { parseGuestWorkbook } from '../src/modules/guests/guest-excel.service.js';

const app = createApp();

describe('HTTP basics (no database needed)', () => {
  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: 'ROUTE_NOT_FOUND' });
    expect(res.body.requestId).toBeTruthy();
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
  });

  it('rejects admin routes without a token', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects a malformed token', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('does not accept a customer token on admin routes', async () => {
    const customerToken = signAccessToken('customer', 1);
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('does not accept a staff token on customer routes', async () => {
    const staffToken = signAccessToken('staff', 1);
    const res = await request(app)
      .get('/api/v1/customer/invitations')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(401);
  });

  it('validates the registration body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ firstName: '', email: 'not-an-email', password: 'weak' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    const fields = (res.body.details as { field: string }[]).map((d) => d.field);
    expect(fields).toEqual(
      expect.arrayContaining(['firstName', 'lastName', 'email', 'phone', 'password']),
    );
  });

  it('reports malformed JSON as 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_JSON');
  });

  it('validates RSVP input before touching the database', async () => {
    const res = await request(app)
      .post('/api/v1/public/invitations/some-slug/rsvp')
      .send({ attending: true });
    expect(res.status).toBe(422);
  });

  it('allows configured CORS origins only', async () => {
    const allowed = await request(app).get('/api/v1/nope').set('Origin', 'http://localhost:3000');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');

    const blocked = await request(app).get('/api/v1/nope').set('Origin', 'https://evil.example');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('serves a sample guest Excel file that the importer accepts', async () => {
    const res = await request(app)
      .get('/api/v1/public/samples/guest-list.xlsx')
      .buffer(true)
      .parse((response, done) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => done(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toContain('guest-list-sample.xlsx');

    const parsed = await parseGuestWorkbook(res.body as Buffer);
    expect(parsed.errors).toEqual([]);
    expect(parsed.guests.map((g) => g.email)).toEqual([
      'nimal.perera@example.com',
      'kamala.silva@example.com',
    ]);
  });
});
