/**
 * Vercel Serverless Function — POST /api/meta/adsets
 */
import { getAdSets } from '../../packages/backend/src/services/metaService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const token = req.headers['x-meta-token'];
  if (!token) return res.status(401).json({ error: 'Meta token required' });

  const { campaignId, since, until, isCpas } = req.body;
  if (!campaignId) return res.status(400).json({ error: 'campaignId required' });

  try {
    const data = await getAdSets(campaignId, { since, until, isCpas }, token);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}
