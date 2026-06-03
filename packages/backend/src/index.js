/**
 * Backend entry point — local development server.
 * Vercel menggunakan api/index.js, bukan file ini.
 */
import { createApp } from './app.js';

const app  = createApp();
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`\n🚀 Backend running → http://localhost:${PORT}`);
  console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`);
});
