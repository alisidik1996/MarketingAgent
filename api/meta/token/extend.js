/**
 * Vercel Serverless Function — POST /api/meta/token/extend
 */
import { extendToken } from '../../../packages/backend/src/services/metaService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });
  try {
    const data = await extendToken(token);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}
