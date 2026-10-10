/**
 * Creates an admin, or resets the password of an existing one.
 *   npm run seed:admin -- --email you@company.com --password "Secret123" --name "Your Name"
 */
import { parseArgs } from 'node:util';
import { closeDatabase } from '../src/config/database.js';
import { hashPassword } from '../src/common/utils/password.js';
import { emailSchema, passwordSchema } from '../src/common/utils/validators.js';
import { staffRepository } from '../src/modules/staff/staff.repository.js';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    password: { type: 'string' },
    name: { type: 'string', default: 'Administrator' },
  },
});

const email = emailSchema.safeParse(values.email);
const password = passwordSchema.safeParse(values.password);
if (!email.success || !password.success) {
  console.error(
    'Usage: npm run seed:admin -- --email you@company.com --password "Secret123" [--name "Your Name"]\n' +
      'The password needs 8+ characters with upper case, lower case and a number.',
  );
  process.exit(1);
}

try {
  const passwordHash = await hashPassword(password.data);
  const existing = await staffRepository.findByEmail(email.data);
  if (existing) {
    await staffRepository.updatePassword(existing.id, passwordHash);
    await staffRepository.update(existing.id, { role: 'admin', is_active: 1 });
    console.log(`Updated ${email.data}: role=admin, password reset.`);
  } else {
    const id = await staffRepository.create({
      name: values.name ?? 'Administrator',
      email: email.data,
      phone: null,
      passwordHash,
      role: 'admin',
      createdBy: null,
    });
    console.log(`Created admin #${id} (${email.data}).`);
  }
} finally {
  await closeDatabase();
}
