# Edge agent (obyektdagi qurilma)

Obyektdagi NVIDIA Jetson Orin (yoki GPU'li kompyuter) IP-kameralar oqimini **joyida** tahlil qiladi. Video internetga chiqmaydi — platformaga faqat hodisa kadri va statistika yuboriladi.

## O'rnatish
1. Platformada: **Kameralar va qurilmalar → Edge qurilma qo'shish**. Ko'rsatilgan `key_id` va `secret` ni saqlang (faqat bir marta ko'rinadi).
2. Kameralarni shu qurilmaga biriktiring va kod nomlarini (`KAM-01`...) `config.json` dagi bilan bir xil qiling.
3. Qurilmada:
   ```bash
   pip install -r requirements.txt
   cp config.example.json config.json && chmod 600 config.json
   export QQ_SECRET='...'          # kalitni faylda emas, muhitda saqlash tavsiya etiladi
   python agent.py --config config.json
   ```
4. Sinov uchun (kamerasiz): `python simulate.py --url https://... --key qqd_... --secret ... --camera KAM-01`

## Xavfsizlik
- Har bir so'rov HMAC-SHA256 bilan imzolanadi, vaqt tamg'asi ±5 daqiqa — tutib olingan so'rovni qayta yuborib bo'lmaydi.
- `event_id` takrorlansa server uni ikkinchi marta yozmaydi.
- Faqat HTTPS, TLS sertifikati doim tekshiriladi.
- Qurilma o'g'irlansa — platformada **Bekor qilish** tugmasi kalitni darhol o'chiradi.
- Internet uzilsa sirena baribir ishlaydi, signallar SQLite navbatida saqlanib, aloqa tiklanganda yuboriladi.

## PPE modeli
Kaska/yelek/kamar uchun mahalliy obyektlarda yig'ilgan rasmlar bilan YOLO modelini o'qiting (sinflar: `person, helmet, no_helmet, vest, no_vest, harness, no_harness`). Model bo'lmasa `yolov8n.pt` bilan faqat odam va xavfli zona nazorati ishlaydi.
