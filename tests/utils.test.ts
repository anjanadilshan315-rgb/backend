import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '../src/common/constants/permissions.js';
import { requireAdmin, requirePermission } from '../src/common/middlewares/authorize.js';
import { AppError } from '../src/common/errors/app-error.js';
import type { AuthStaff } from '../src/common/types/auth.js';
import { parseJsonColumn } from '../src/common/utils/json.js';
import { likePattern } from '../src/common/utils/pagination.js';
import { buildSetClause } from '../src/common/utils/sql.js';
import { escapeHtml, randomSlugSuffix, slugify } from '../src/common/utils/strings.js';
import { renderInvitationEmail } from '../src/modules/emails/templates/invitation-email.js';
import { formatLongDate, formatTime } from '../src/modules/emails/templates/layout.js';
import { buildInviteUrl } from '../src/modules/invitations/invitation.mapper.js';

describe('strings', () => {
  it('slugifies couple names', () => {
    expect(slugify('Kaveen & Ishara')).toBe('kaveen-ishara');
    expect(slugify('  Ánne—Marie  ')).toBe('anne-marie');
    expect(slugify('කවීන්')).toBe('wedding');
  });

  it('creates short lowercase slug suffixes', () => {
    expect(randomSlugSuffix()).toMatch(/^[a-z2-9]{4}$/);
  });

  it('escapes HTML', () => {
    expect(escapeHtml(`<script>"x" & 'y'</script>`)).toBe(
      '&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;',
    );
  });
});

describe('sql helpers', () => {
  it('skips undefined fields but keeps null', () => {
    expect(buildSetClause({ a: 1, b: undefined, c: null })).toEqual({
      sql: '`a` = ?, `c` = ?',
      values: [1, null],
    });
  });

  it('escapes LIKE wildcards', () => {
    expect(likePattern('50%_off')).toBe('%50\\%\\_off%');
  });

  it('parses JSON columns from MySQL and MariaDB', () => {
    expect(parseJsonColumn('[1,2]', [])).toEqual([1, 2]);
    expect(parseJsonColumn([1, 2], [])).toEqual([1, 2]);
    expect(parseJsonColumn(null, { a: 1 })).toEqual({ a: 1 });
    expect(parseJsonColumn('{broken', [])).toEqual([]);
  });
});

describe('e-mail rendering', () => {
  it('formats dates and times', () => {
    expect(formatLongDate('2026-11-28')).toBe('Saturday, 28 November 2026');
    expect(formatTime('16:30:00')).toBe('4:30 PM');
    expect(formatTime('00:05:00')).toBe('12:05 AM');
  });

  it('builds personalised invite links', () => {
    expect(buildInviteUrl('kaveen-ishara', { name: 'Nimal Perera', inviteCode: 'abc123' })).toBe(
      'http://localhost:3000/invite/kaveen-ishara?guest=Nimal+Perera&code=abc123',
    );
  });

  it('escapes user content in the invitation e-mail', () => {
    const mail = renderInvitationEmail({
      to: 'guest@example.com',
      guestName: '<b>Nimal</b>',
      groomName: 'Kaveen',
      brideName: 'Ishara',
      weddingDate: '2026-11-28',
      weddingTime: '16:30:00',
      venueName: 'Grand Hall',
      venueAddress: null,
      greetingMessage: null,
      coverImageUrl: null,
      inviteUrl: 'http://localhost:3000/invite/x?guest=a&code=b',
    });
    expect(mail.subject).toBe('Wedding invitation: Kaveen & Ishara');
    expect(mail.html).toContain('&lt;b&gt;Nimal&lt;/b&gt;');
    expect(mail.html).not.toContain('<b>Nimal</b>');
    expect(mail.text).toContain('Venue: Grand Hall');
  });
});

describe('authorization middleware', () => {
  const staff = (role: AuthStaff['role'], permissions: AuthStaff['permissions'] = new Set()) =>
    ({
      staff: { id: 1, name: 'x', email: 'x@example.com', role, permissions },
    }) as unknown as Request;
  const res = {} as Response;

  it('lets admins through every permission check', () => {
    const next = vi.fn();
    requirePermission(PERMISSIONS.INVITATIONS_DELETE)(staff('admin'), res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('checks granted permissions for users', () => {
    const user = staff('user', new Set([PERMISSIONS.INVITATIONS_VIEW]));
    const next = vi.fn();
    requirePermission(PERMISSIONS.INVITATIONS_VIEW)(user, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(() => requirePermission(PERMISSIONS.INVITATIONS_UPDATE_STATUS)(user, res, next)).toThrow(
      AppError,
    );
  });

  it('keeps staff management admin-only', () => {
    expect(() =>
      requireAdmin(staff('user', new Set(Object.values(PERMISSIONS))), res, vi.fn()),
    ).toThrow('Only admins');
  });
});
