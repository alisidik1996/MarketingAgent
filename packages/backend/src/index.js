import express      from 'express';
import cors         from 'cors';
import metaRoutes   from './routes/meta.js';
import aiRoutes     from './routes/ai.js';

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGIN || 'http://localhost:5173'
    : '*',
  methods: ['GET', 'POST'],
}));
app.use(express.json({ limit: '2mb' }));

// ── Health check ──────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────
app.use('/api/meta', metaRoutes);
app.use('/api/ai',   aiRoutes);

// ── Error handler ─────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Backend running → http://localhost:${PORT}`);
  console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`);
});
