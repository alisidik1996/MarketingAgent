/**
 * AI proxy routes — BluesMinds gateway
 * API key is stored server-side only.
 */
import { Router } from 'express';
import fetch       from 'node-fetch';

const router = Router();
const AI_KEY  = process.env.BLUESMINDS_API_KEY;
const AI_BASE = process.env.BLUESMINDS_BASE || 'https://api.bluesminds.com/v1';

// ── POST /api/ai/chat ─────────────────────────────────
router.post('/chat', async (req, res, next) => {
  const { model, messages, temperature, max_tokens } = req.body;

  if (!messages?.length) {
    return res.status(400).json({ error: 'messages required' });
  }

  try {
    const aiRes = await fetch(`${AI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${AI_KEY}`,
      },
      body: JSON.stringify({
        model:       model || 'gpt-5-chat',
        messages,
        temperature: temperature ?? 0.7,
        max_tokens:  max_tokens ?? 2048,
        stream:      false,
      }),
    });

    const data = await aiRes.json();

    if (data.error) {
      const err = new Error(data.error.message || 'AI API error');
      err.status = aiRes.status;
      throw err;
    }

    res.json(data);
  } catch (err) { next(err); }
});

// ── GET /api/ai/models ────────────────────────────────
router.get('/models', (_req, res) => {
  res.json([
    { id: 'gpt-5-chat',         label: 'GPT-5 Chat'    },
    { id: 'gpt-3.5-turbo-0613', label: 'GPT-3.5 Turbo' },
  ]);
});

export default router;
