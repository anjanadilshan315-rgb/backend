import { escapeHtml } from '../../../common/utils/strings.js';

/** Table-based layout with inline styles — the only kind e-mail clients render reliably. */
export function emailLayout(options: { preheader: string; body: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.preheader)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f1e7;font-family:Georgia,'Times New Roman',serif;color:#3d3326;">
<span style="display:none;max-height:0;overflow:hidden;">${escapeHtml(options.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1e7;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf8;border:1px solid #e8dcc4;border-radius:12px;overflow:hidden;">
      ${options.body}
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function button(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:#b08d57;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:999px;font-family:Arial,sans-serif;font-size:14px;letter-spacing:1px;text-transform:uppercase;">${escapeHtml(label)}</a>`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "2026-11-28" -> "Saturday, 28 November 2026" (no ICU dependency, so output is stable). */
export function formatLongDate(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "16:30:00" -> "4:30 PM" */
export function formatTime(time: string | null): string | null {
  if (!time) return null;
  const [h = 0, m = 0] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
}
