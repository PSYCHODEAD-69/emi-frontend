/* ============================================================
   ELECTROMOTIVE INVENTORY — config.js
   Centralized configuration. Every value that might need to
   change later (API URL, WhatsApp number, contact details) lives
   here and ONLY here — no other file should hardcode these.
   ============================================================ */

/* ── BRAND ── */
window.BRAND_NAME = "Electromotive Inventory";

/* ── BACKEND API URL ──
   Replace this with the final "emi-worker" Cloudflare Worker URL
   once it is deployed. This is the ONLY place the API base URL
   should ever be defined. */
window.EMI_API_URL = "https://emi-worker.YOUR-SUBDOMAIN.workers.dev";

/* ── CONTACT / ORDERING ──
   WhatsApp is the only ordering method. Replace this placeholder
   number with the real business number when available. */
window.EMI_WHATSAPP_NUMBER = "1234567890";

/* Contact email shown in footer / contact sections. */
window.EMI_EMAIL = "electromotiveinventory@gmail.com";

/* Placeholder Instagram URL — replace with the real account once created. */
window.EMI_INSTAGRAM_URL = "https://instagram.com/electromotiveinventory";
