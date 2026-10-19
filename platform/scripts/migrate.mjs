// Build paytida ma'lumotlar bazasi sxemasini qo'llaydi (idempotent).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import postgres from 'postgres';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.warn('[migrate] DATABASE_URL topilmadi — migratsiya o\'tkazib yuborildi.');
  process.exit(0);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
const schema = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'schema.sql'), 'utf8');
try {
  await sql.unsafe(schema);
  console.log('[migrate] Sxema muvaffaqiyatli qo\'llandi.');
} catch (err) {
  console.error('[migrate] Xato:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
