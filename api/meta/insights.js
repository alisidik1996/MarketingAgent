/**
 * Vercel Serverless Function — POST /api/meta/insights
 */
import { getInsights } from '../../packages/backend/src/services/metaService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const token = req.headers['x-meta-token'];
  if (!token) return res.status(401).json({ error: 'Meta token required' });

  const { accountId, fields, since, until, level, timeIncrement } = req.body;
  if (!accountId) return res.status(400).json({ error: 'accountId required' });
  if (!fields)    return res.status(400).json({ error: 'fields required' });

  try {
    const data = await getInsights(accountId, { fields, since, until, level, timeIncrement }, token);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}
