import 'server-only';
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';

const N = 32768, R = 8, P = 1, KEYLEN = 64;

function scrypt(pw: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(pw.normalize('NFKC'), salt, KEYLEN, { N: n, r, p, maxmem: 128 * n * r * 2 }, (err, key) =>
      err ? reject(err) : resolve(key as Buffer),
    ),
  );
}

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(pw, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(pw: string, stored: string) {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scrypt(pw, Buffer.from(salt, 'base64'), Number(n), Number(r), Number(p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Foydalanuvchi topilmaganda ham bir xil vaqt sarflash uchun (foydalanuvchini aniqlash hujumidan himoya). */
let dummy: string | null = null;
export async function burnPasswordTime(pw: string) {
  dummy ??= await hashPassword('dummy-password-for-timing');
  await verifyPassword(pw, dummy);
}

const COMMON = new Set([
  'password1234', 'qwerty123456', '1234567890', '12345678910', 'admin12345', 'parol12345',
  'qwertyuiop1', 'iloveyou123', 'password123', 'welcome1234', 'Qwerty12345',
]);

/** Parol siyosati. Xato bo'lsa — o'zbekcha izoh, bo'lmasa null. */
export function passwordProblem(pw: string, email?: string): string | null {
  if (pw.length < 10) return "Parol kamida 10 belgidan iborat bo'lishi kerak";
  if (pw.length > 128) return 'Parol juda uzun (maksimal 128 belgi)';
  if (!/[A-Za-zА-Яа-яЎўҚқҒғҲҳ]/.test(pw) || !/\d/.test(pw)) return "Parolda kamida bitta harf va bitta raqam bo'lishi kerak";
  if (COMMON.has(pw.toLowerCase())) return 'Bu parol juda keng tarqalgan — boshqasini tanlang';
  if (email && pw.toLowerCase().includes(email.split('@')[0].toLowerCase())) return "Parolda email nomingiz bo'lmasligi kerak";
  return null;
}

/** Vaqtinchalik parol: o'qish oson, lekin kuchli (~80 bit). */
export function generateTempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(16);
  let out = '';
  for (let i = 0; i < 14; i++) out += alphabet[bytes[i] % alphabet.length];
  return out.slice(0, 7) + '-' + out.slice(7) + '7';
}
