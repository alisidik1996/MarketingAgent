/**
 * Vercel Serverless Function entry point.
 * Semua request ke /api/* diarahkan ke sini oleh vercel.json.
 *
 * Vercel otomatis load environment variables dari dashboard —
 * tidak perlu dotenv di sini.
 */
import { createApp } from '../packages/backend/src/app.js';

const app = createApp();

// Vercel butuh default export berupa request handler
export default app;
