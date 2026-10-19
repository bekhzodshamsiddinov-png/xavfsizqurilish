import 'server-only';
import postgres from 'postgres';

declare global {
  // eslint-disable-next-line no-var
  var __qqSql: ReturnType<typeof postgres> | undefined;
}

function create() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL sozlanmagan");
  return postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // Neon/PgBouncer pooler bilan mos
    onnotice: () => {},
  });
}

/** Yagona ulanish havzasi. Barcha so'rovlar tagged-template orqali — SQL inyeksiyadan himoyalangan. */
export const sql = globalThis.__qqSql ?? (globalThis.__qqSql = create());

export function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}
