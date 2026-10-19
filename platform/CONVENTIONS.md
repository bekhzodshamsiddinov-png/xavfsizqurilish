# Qurilish Qalqoni — kod qoidalari

Next.js 15 App Router, React 19, TypeScript strict, Tailwind 3, Postgres (`postgres` paketi), zod 4, lucide-react.
Barcha UI matnlari **o'zbek tilida (lotin)**. Apostrof — oddiy `'` (o', g').

## Tuzilma
- `src/app/(auth)/` — login, setup, 2FA, majburiy parol almashtirish (menyusiz maket).
- `src/app/(app)/` — tizimga kirganlar uchun sahifalar (menyuli maket `layout.tsx`, u `requirePage('view')` chaqiradi).
- Har bir sahifa papkasida: `page.tsx` (server komponent, ma'lumotni o'zi o'qiydi), `actions.ts` (`'use server'`), kerak bo'lsa `*.client.tsx` (`'use client'`).
- `src/lib/` — db, security, labels, site, alerts. `src/components/ui.tsx` (server-xavfsiz primitivlar), `src/components/client.tsx` (SubmitButton, FormMessage, Toggle).

## Xavfsizlik — MAJBURIY
1. **Har bir sahifa** boshida: `const user = await requirePage('<perm>')` (`@/lib/security/session`). Huquqlar: `@/lib/security/rbac` dagi `PERMS`.
2. **Har bir server amali** (`'use server'`) birinchi qatorda: `const user = await requireAction('<perm>')`. UI'da tugmani yashirish — himoya EMAS, faqat qulaylik.
3. **Barcha kiruvchi ma'lumot zod bilan tekshiriladi** (`Object.fromEntries(formData)` → `schema.safeParse`). UUID'lar `z.uuid()`. Matn uzunligi doim `.max()` bilan cheklanadi.
4. **SQL faqat tagged template**: ``sql`... ${value}` ``. `sql.unsafe` va satr birlashtirish TAQIQLANGAN.
5. Obyektga tegishli yozuvlar o'zgartirilganda `site_id` bo'yicha ham tekshiring (masalan, zona kamerasi joriy obyektga tegishlimi).
6. Muhim amallardan keyin `await audit(user.id, 'modul.amal', targetId, {...})` (`@/lib/security/audit`). Maxfiy qiymatlarni (parol, kalit) auditga yozmang.
7. Maxfiy qiymatlar (qurilma kaliti, TOTP) bazaga `encrypt()` bilan yoziladi; foydalanuvchiga faqat **bir marta** ko'rsatiladi.
8. Xato xabarlari foydalanuvchiga umumiy, ichki tafsilotsiz (stack, SQL ko'rsatilmaydi).
9. `dangerouslySetInnerHTML` ishlatilmaydi. Tashqi skript/CDN yo'q (CSP buni bloklaydi).
10. Amallar natijasi: `{ error?: string; ok?: string }` (`FormState`), formalar `useActionState` + `SubmitButton` + `FormMessage` bilan. Muvaffaqiyatdan keyin `revalidatePath(...)`.

## Joriy obyekt
`const site = await currentSite()` (`@/lib/site`). `null` bo'lsa — obyekt yaratishga undovchi `EmptyState` ko'rsating (`/cameras#obyekt` ga havola).

## Dizayn
- Fon `#F6F7F9`, kartalar `Card` (oq, rounded-2xl, ring). Brend sariq `#FFC400`, grafit `#14161A`, qizil — kritik, to'q sariq — ogohlantirish, yashil — OK.
- Tugmalar: `btnClass('primary'|'secondary'|'danger'|'ghost'|'dark')`. Inputlar: `inputClass`. Sarlavha: `PageTitle`.
- Mobilga moslashgan bo'lsin (grid'lar `sm:`/`lg:` bilan).
- Kadrlar: `<img src={`/api/snapshots/camera/${id}`}>` yoki `/api/snapshots/alert/${id}` (autentifikatsiyali yo'l).
- Zona koordinatalari: `points` = `[[x,y],...]` foizlarda (0–100), kadr o'lchamiga bog'liq emas.
