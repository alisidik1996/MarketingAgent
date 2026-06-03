/**
 * Backend entry point — Express app bootstrap.
 * Wires up middleware, routes, and error handling.
 */
import express      from 'express';
import cors         from 'cors';
import apiRoutes    from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

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

// ── API Routes ────────────────────────────────────────
app.use('/api', apiRoutes);

// ── Error Handler (must be last) ─────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n🚀 Backend running → http://localhost:${PORT}`);
  console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`);
});
