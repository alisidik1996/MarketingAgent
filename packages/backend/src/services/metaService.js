/**
 * Meta Graph API service layer.
 * Handles all direct communication with the Meta Graph API.
 * No Express req/res here — pure data access functions.
 */
import fetch from 'node-fetch';
import {
  META_BASE,
  APP_ID,
  APP_SECRET,
  CPAS_EXTRA_FIELDS,
} from '../config/meta.js';

// ── Core fetch helpers ────────────────────────────────

/**
 * Single GET request to Graph API.
 * @param {string} path   - e.g. '/act_123/campaigns'
 * @param {object} params - query params object (access_token required)
 */
export async function graphGet(path, params = {}) {
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

/**
 * Auto-paginated GET — follows paging.next until exhausted.
 */
export async function graphGetAll(path, params = {}) {
  let results = [];
  let data    = await graphGet(path, params);
  results     = results.concat(data.data || []);

  while (data.paging?.next) {
    const nextUrl = new URL(data.paging.next);
    // Always use our server-side token, not whatever is in the paging URL
    nextUrl.searchParams.set('access_token', params.access_token);
    const res = await fetch(nextUrl.toString());
    data      = await res.json();
    if (data.error) throw new Error(data.error.message);
    results = results.concat(data.data || []);
  }
  return results;
}

// ── Token services ────────────────────────────────────

/**
 * Inspect a user token using app-level credentials.
 */
export async function inspectToken(token) {
  const url = new URL(`${META_BASE}/debug_token`);
  url.searchParams.set('input_token',  token);
  url.searchParams.set('access_token', `${APP_ID}|${APP_SECRET}`);
  const res  = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data;
}

/**
 * Exchange a short-lived token for a long-lived one.
 */
export async function extendToken(token) {
  const url = new URL(`${META_BASE}/oauth/access_token`);
  url.searchParams.set('grant_type',       'fb_exchange_token');
  url.searchParams.set('client_id',         APP_ID);
  url.searchParams.set('client_secret',     APP_SECRET);
  url.searchParams.set('fb_exchange_token', token);
  const res  = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data; // { access_token, token_type, expires_in }
}

// ── Account & campaign services ───────────────────────

export async function getAccount(accountId, token) {
  return graphGet(`/act_${accountId}`, {
    fields:       'name,currency,account_status,timezone_name,amount_spent,balance,spend_cap',
    access_token: token,
  });
}

export async function getCampaigns(accountId, token) {
  return graphGetAll(`/act_${accountId}/campaigns`, {
    fields:       'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,budget_remaining',
    limit:        100,
    access_token: token,
  });
}

export async function getInsights(accountId, { fields, since, until, level, timeIncrement }, token) {
  const params = {
    fields,
    time_range:   JSON.stringify({ since, until }),
    level:        level || 'campaign',
    limit:        100,
    access_token: token,
  };
  if (timeIncrement) params.time_increment = timeIncrement;
  return graphGetAll(`/act_${accountId}/insights`, params);
}

// ── Ad sets & ads services ────────────────────────────

export async function getAdSets(campaignId, { since, until, isCpas }, token) {
  const insightFields = isCpas
    ? 'adset_id,spend,impressions,clicks,ctr,cpc,reach,frequency,actions,inline_link_clicks' + CPAS_EXTRA_FIELDS
    : 'adset_id,spend,impressions,clicks,ctr,cpc,reach,frequency,actions,inline_link_clicks';

  const [adsets, insights] = await Promise.all([
    graphGetAll(`/${campaignId}/adsets`, {
      fields:       'id,name,status,daily_budget,lifetime_budget,optimization_goal,billing_event',
      limit:        50,
      access_token: token,
    }),
    graphGetAll(`/${campaignId}/insights`, {
      fields:      insightFields,
      time_range:  JSON.stringify({ since, until }),
      level:       'adset',
      limit:       50,
      access_token: token,
    }),
  ]);

  const iMap = {};
  insights.forEach(i => { iMap[i.adset_id] = i; });
  return adsets.map(a => ({ ...a, ins: iMap[a.id] || {} }));
}

export async function getAds(campaignId, { since, until, isCpas, adsetId }, token) {
  const insightFields = isCpas
    ? 'ad_id,spend,impressions,clicks,ctr,cpc,reach,actions,inline_link_clicks' + CPAS_EXTRA_FIELDS
    : 'ad_id,spend,impressions,clicks,ctr,cpc,reach,actions,inline_link_clicks';

  const adsPath = adsetId ? `/${adsetId}/ads` : `/${campaignId}/ads`;

  const [ads, insights] = await Promise.all([
    graphGetAll(adsPath, {
      fields:       'id,name,status',
      limit:        50,
      access_token: token,
    }),
    graphGetAll(`/${campaignId}/insights`, {
      fields:      insightFields,
      time_range:  JSON.stringify({ since, until }),
      level:       'ad',
      ...(adsetId
        ? { filtering: JSON.stringify([{ field: 'adset.id', operator: 'EQUAL', value: adsetId }]) }
        : {}),
      limit:       50,
      access_token: token,
    }),
  ]);

  const iMap = {};
  insights.forEach(i => { iMap[i.ad_id] = i; });
  return ads.map(a => ({ ...a, ins: iMap[a.id] || {} }));
}
