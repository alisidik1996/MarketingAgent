/**
 * Meta API proxy routes
 * All requests to Meta Graph API are proxied through here so that
 * the Meta token is NEVER exposed in frontend source code.
 */
import { Router } from 'express';
import fetch       from 'node-fetch';

const router         = Router();
const META_VERSION   = 'v20.0';
const META_BASE      = `https://graph.facebook.com/${META_VERSION}`;
const APP_ID         = process.env.META_APP_ID;
const APP_SECRET     = process.env.META_APP_SECRET;

// ── Helper: proxy a GET to Graph API ─────────────────
async function graphGet(path, params = {}) {
  const url = new URL(`${META_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res  = await fetch(url.toString());
  const data = await res.json();
  if (data.error) {
    const err = new Error(data.error.message);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ── Helper: paginate through all results ─────────────
async function graphGetAll(path, params = {}) {
  let results = [];
  let data    = await graphGet(path, params);
  results = results.concat(data.data || []);
  while (data.paging?.next) {
    const nextUrl = new URL(data.paging.next);
    // Re-inject token from env (strip whatever token is in next URL)
    nextUrl.searchParams.set('access_token', params.access_token);
    const res  = await fetch(nextUrl.toString());
    data       = await res.json();
    if (data.error) throw new Error(data.error.message);
    results = results.concat(data.data || []);
  }
  return results;
}

// ── Middleware: require token in body or header ───────
function requireToken(req, res, next) {
  const token = req.headers['x-meta-token'] || req.body?.token;
  if (!token) return res.status(401).json({ error: 'Meta token required' });
  req.metaToken = token;
  next();
}

// ── POST /api/meta/token/inspect ──────────────────────
router.post('/token/inspect', async (req, res, next) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });
  try {
    const url = new URL(`${META_BASE}/debug_token`);
    url.searchParams.set('input_token',  token);
    url.searchParams.set('access_token', `${APP_ID}|${APP_SECRET}`);
    const r    = await fetch(url.toString());
    const data = await r.json();
    if (data.error) throw new Error(data.error.message);
    res.json(data.data);
  } catch (err) { next(err); }
});

// ── POST /api/meta/token/extend ───────────────────────
router.post('/token/extend', async (req, res, next) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });
  try {
    const url = new URL(`${META_BASE}/oauth/access_token`);
    url.searchParams.set('grant_type',        'fb_exchange_token');
    url.searchParams.set('client_id',          APP_ID);
    url.searchParams.set('client_secret',      APP_SECRET);
    url.searchParams.set('fb_exchange_token',  token);
    const r    = await fetch(url.toString());
    const data = await r.json();
    if (data.error) throw new Error(data.error.message);
    res.json(data); // { access_token, token_type, expires_in }
  } catch (err) { next(err); }
});

// ── POST /api/meta/account ────────────────────────────
router.post('/account', requireToken, async (req, res, next) => {
  const { accountId } = req.body;
  try {
    const data = await graphGet(`/act_${accountId}`, {
      fields: 'name,currency,account_status,timezone_name,amount_spent,balance,spend_cap',
      access_token: req.metaToken,
    });
    res.json(data);
  } catch (err) { next(err); }
});

// ── POST /api/meta/campaigns ──────────────────────────
router.post('/campaigns', requireToken, async (req, res, next) => {
  const { accountId } = req.body;
  try {
    const data = await graphGetAll(`/act_${accountId}/campaigns`, {
      fields: 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,budget_remaining',
      limit: 100,
      access_token: req.metaToken,
    });
    res.json(data);
  } catch (err) { next(err); }
});

// ── POST /api/meta/insights ───────────────────────────
router.post('/insights', requireToken, async (req, res, next) => {
  const { accountId, fields, since, until, level, timeIncrement } = req.body;
  const params = {
    fields,
    time_range:  JSON.stringify({ since, until }),
    level:       level || 'campaign',
    limit:       100,
    access_token: req.metaToken,
  };
  if (timeIncrement) params.time_increment = timeIncrement;
  try {
    const data = await graphGetAll(`/act_${accountId}/insights`, params);
    res.json(data);
  } catch (err) { next(err); }
});

const CPAS_EXTRA_FIELDS = ',catalog_segment_actions,catalog_segment_value,catalog_segment_value_omni_purchase_roas';

// ── POST /api/meta/adsets ─────────────────────────────
router.post('/adsets', requireToken, async (req, res, next) => {
  const { campaignId, since, until, isCpas } = req.body;
  const insightFields = isCpas
    ? 'adset_id,spend,impressions,clicks,ctr,cpc,reach,frequency,actions,inline_link_clicks' + CPAS_EXTRA_FIELDS
    : 'adset_id,spend,impressions,clicks,ctr,cpc,reach,frequency,actions,inline_link_clicks';
  try {
    const [adsets, insights] = await Promise.all([
      graphGetAll(`/${campaignId}/adsets`, {
        fields: 'id,name,status,daily_budget,lifetime_budget,optimization_goal,billing_event',
        limit: 50,
        access_token: req.metaToken,
      }),
      graphGetAll(`/${campaignId}/insights`, {
        fields: insightFields,
        time_range: JSON.stringify({ since, until }),
        level: 'adset',
        limit: 50,
        access_token: req.metaToken,
      }),
    ]);
    const iMap = {};
    insights.forEach(i => { iMap[i.adset_id] = i; });
    res.json(adsets.map(a => ({ ...a, ins: iMap[a.id] || {} })));
  } catch (err) { next(err); }
});

// ── POST /api/meta/ads ────────────────────────────────
router.post('/ads', requireToken, async (req, res, next) => {
  const { campaignId, since, until, isCpas, adsetId } = req.body;
  const insightFields = isCpas
    ? 'ad_id,spend,impressions,clicks,ctr,cpc,reach,actions,inline_link_clicks' + CPAS_EXTRA_FIELDS
    : 'ad_id,spend,impressions,clicks,ctr,cpc,reach,actions,inline_link_clicks';

  // If adsetId provided, fetch ads from adset directly (more precise)
  const adsPath = adsetId ? `/${adsetId}/ads` : `/${campaignId}/ads`;

  try {
    const [ads, insights] = await Promise.all([
      graphGetAll(adsPath, {
        fields: 'id,name,status',
        limit: 50,
        access_token: req.metaToken,
      }),
      graphGetAll(`/${campaignId}/insights`, {
        fields: insightFields,
        time_range: JSON.stringify({ since, until }),
        level: 'ad',
        ...(adsetId ? { filtering: JSON.stringify([{ field: 'adset.id', operator: 'EQUAL', value: adsetId }]) } : {}),
        limit: 50,
        access_token: req.metaToken,
      }),
    ]);
    const iMap = {};
    insights.forEach(i => { iMap[i.ad_id] = i; });
    res.json(ads.map(a => ({ ...a, ins: iMap[a.id] || {} })));
  } catch (err) { next(err); }
});

export default router;
