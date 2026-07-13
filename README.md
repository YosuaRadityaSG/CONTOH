# CONTOH

Backend ini menyediakan endpoint webhook Telegram untuk membalas pesan dengan Gemini dan Wikipedia. Jawaban Gemini sekarang mengikuti gaya WikiBot yang netral, faktual, dan terstruktur seperti Wikipedia.

## Environment

Set variabel berikut sebelum menjalankan server. File `.env` sudah disiapkan di root proyek.

- `PORT` untuk port server, default `3000`
- `TELEGRAM_BOT_TOKEN` untuk token bot Telegram
- `GEMINI_API_KEY` untuk API key Gemini
- `GEMINI_MODEL` untuk nama model Gemini, default `gemini-1.5-flash`

## Endpoint

- `GET /` cek status server
- `GET /health` health check
- `POST /gemini/ask` coba Gemini langsung dengan body `{ "prompt": "..." }`
- `GET /wikipedia/summary/:title` coba summary Wikipedia langsung
- `POST /telegram/webhook` menerima update Telegram lalu mengirim respons Gemini bergaya WikiBot ke chat
