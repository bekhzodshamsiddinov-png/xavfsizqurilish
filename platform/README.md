# Qurilish Qalqoni — platforma

Kameralar va sun'iy intellekt yordamida qurilish obyektlarida xavfsizlikni nazorat qiluvchi veb-platforma.
Next.js 15 · React 19 · TypeScript · Tailwind · Postgres (Neon) · Vercel.

## Imkoniyatlar
| Bo'lim | Nima qiladi |
|---|---|
| **Boshqaruv paneli** | Ochiq signallar, PPE rioyasi, kritik hodisasiz kunlar, onlayn kameralar, xavfsizlik indeksi, 7 kunlik grafik, qavatlar xavf xaritasi |
| **Jonli kuzatuv** | Kameralarning so'nggi kadrlari, zonalar qatlami, onlayn/oflayn holat, har 10 s yangilanadi |
| **Ogohlantirishlar** | Filtrlash, dalil kadri, "Men olaman" / "Hal qilindi" / "Yolg'on signal", eskalatsiya, CSV eksport |
| **Xavfli zonalar** | Kamera kadri ustida zona chizish, ogohlantirish masofasi, ruxsat etilgan kasblar, signal turlari, faol vaqt |
| **Brauzer detektori** | Telefon/noutbuk kamerasida AI (COCO-SSD) — odam xavfli zonaga kirsa sirena + ovozli xabar + signal |
| **Xodimlar** | Brigada, beyj, yo'riqnoma muddati nazorati |
| **Hisobotlar** | Turlar, kameralar, xavfli soatlar, javob vaqti, yolg'on signallar ulushi, PDF/CSV |
| **Kameralar va qurilmalar** | Obyektlar, kameralar, edge-qurilmalar (HMAC kalitlari) |
| **Sozlamalar** | Foydalanuvchilar va rollar, Telegram, audit jurnali, demo ma'lumotlar |

## Xavfsizlik arxitekturasi
- **Parollar:** scrypt (N=32768), kamida 10 belgi, keng tarqalgan parollar rad etiladi. Foydalanuvchi mavjud-mavjud emasligini vaqt orqali aniqlab bo'lmaydi.
- **Kirish himoyasi:** IP bo'yicha 15 daqiqada 30 urinish; (email + IP) juftligi uchun 5 xato urinishdan so'ng 15 daqiqalik blok — begona odam o'z IP'sidan sizning hisobingizni bloklay olmaydi; email bo'yicha umumiy 50 xato/soat. Barcha hisoblagichlar atomik (parallel so'rovlar bilan aylanib o'tib bo'lmaydi).
- **2FA:** TOTP (Google Authenticator), kodni qayta ishlatish taqiqlangan, maxfiy kalit AES-256-GCM bilan shifrlangan.
- **Sessiyalar:** 256-bit tasodifiy token, bazada faqat SHA-256 xeshi; cookie `__Host-`, `HttpOnly`, `Secure`, `SameSite=Strict`; 12 soat maksimal, 2 soat harakatsizlik; kirishda sessiya almashtiriladi; parol almashsa boshqa sessiyalar yopiladi.
- **Rollar (RBAC):** administrator, xavfsizlik nazoratchisi, prorab, kuzatuvchi — har bir server amali huquqni qayta tekshiradi.
- **CSRF:** `SameSite=Strict` + Origin/Sec-Fetch-Site tekshiruvi + Next.js server amallari himoyasi.
- **Sarlavhalar:** nonce asosidagi qat'iy CSP, HSTS (preload), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP/CORP.
- **Ma'lumotlar:** barcha SQL — parametrlangan; barcha kiritmalar zod bilan tekshiriladi; kadrlar faqat autentifikatsiya orqali, keshlanmasdan beriladi; CSV formula-inyeksiyasidan himoyalangan.
- **Qurilma API:** HMAC-SHA256 imzo, ±5 daqiqa vaqt oynasi, `event_id` bo'yicha idempotentlik, kamera qurilmaga biriktirilgan bo'lishi shart, so'rov hajmi va tezligi cheklangan, faqat JPEG qabul qilinadi.
- **Audit jurnali:** kirishlar, xatolar, barcha o'zgarishlar — kim, qachon, qayerdan.
- **O'rnatish:** birinchi administrator faqat maxfiy `SETUP_TOKEN` bilan va faqat foydalanuvchi bo'lmaganda yaratiladi.

## Kirish modeli
Platforma **bitta tashkilot** (qurilish kompaniyasi) uchun mo'ljallangan: kompaniyaning barcha xodimlari o'z roliga ko'ra kompaniyaning barcha obyektlarini ko'radi. Turli mijozlarni bitta o'rnatishda saqlash (multi-tenant) kerak bo'lsa, keyingi bosqichda `site_members` jadvali qo'shiladi.

## Mustaqil xavfsizlik auditi (2026-10-19)
Alohida agent tomonidan o'tkazildi: Critical darajadagi zaiflik topilmadi; 2FA va autentifikatsiyani chetlab o'tib bo'lmaydi. Topilgan o'rta/past darajali kamchiliklar (admin hisobini begona odam bloklashi, parallel so'rovlar bilan limitni aylanib o'tish, eskalatsiya ishonchliligi, signal holati o'tishlari, qurilma API hajm cheklovi, 2FA o'zgarganda sessiyalar, CSP torligi) tuzatildi va qayta sinovdan o'tkazildi.

## Muhit o'zgaruvchilari
| Nomi | Majburiy | Izoh |
|---|---|---|
| `DATABASE_URL` | ha | Neon integratsiyasi avtomatik qo'yadi |
| `ENCRYPTION_KEY` | ha | 32 bayt, base64 |
| `SETUP_TOKEN` | birinchi o'rnatishda | o'rnatishdan keyin o'chirib yuborish mumkin |
| `TELEGRAM_BOT_TOKEN` | yo'q | @BotFather dan; guruh ID si Sozlamalar sahifasida |

## Lokal ishga tushirish
```bash
cp .env.example .env.local    # qiymatlarni to'ldiring
npm install
npm run migrate
npm run dev
```

## Qurilma API
`POST /api/v1/heartbeat`, `POST /api/v1/events` — tafsilotlar va Python agent: [`../edge`](../edge).
