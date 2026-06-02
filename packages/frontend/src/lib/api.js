/**
 * API client — all calls go to our backend proxy.
 * The Meta token is sent in a header (never in URL / public source).
 */
import { API_BASE, INSIGHT_FIELDS, INSIGHT_FIELDS_CPAS } from './config.js';

// ── Meta token storage ────────────────────────────────
let _token = '';
export const setToken = t => { _token = t; };
export const getToken = ()  => _token;

// ── Base fetch helper ─────────────────────────────────
async function post(path, body = {}) {
  const res  = await fetch(`${API_BASE}${path}`, {
    method:  'POST',
    headers: {
      'Content-Type':   'application/json',
      'x-meta-token':   _token,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || data.error || `HTTP ${res.status}`);
  }
  return data;
}

async function get(path) {
  const res  = await fetch(`${API_BASE}${path}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Token endpoints ───────────────────────────────────
export const inspectToken = token =>
  post('/meta/token/inspect', { token });

export const extendToken = token =>
  post('/meta/token/extend', { token });

// ── Meta data endpoints ───────────────────────────────
export const fetchAccount = accountId =>
  post('/meta/account', { accountId });

export const fetchCampaigns = accountId =>
  post('/meta/campaigns', { accountId });

export const fetchCampaignInsights = (accountId, { since, until }, isCpas = false) =>
  post('/meta/insights', {
    accountId,
    fields: isCpas ? INSIGHT_FIELDS_CPAS : INSIGHT_FIELDS,
    since, until, level: 'campaign',
  });

export const fetchAccountInsights = (accountId, { since, until }) =>
  post('/meta/insights', {
    accountId,
    fields: 'spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,action_values,cost_per_action_type,inline_link_clicks',
    since, until, level: 'account',
  });

export const fetchDailyInsights = (accountId, { since, until }) =>
  post('/meta/insights', {
    accountId,
    fields: 'spend,clicks,impressions,reach,date_start',
    since, until, level: 'account',
    timeIncrement: 1,
  });

export const fetchAdSets = (campaignId, { since, until }, isCpas = false) =>
  post('/meta/adsets', { campaignId, since, until, isCpas });

export const fetchAds = (campaignId, { since, until }, isCpas = false, adsetId = null) =>
  post('/meta/ads', { campaignId, since, until, isCpas, adsetId });

// ── AI endpoint ───────────────────────────────────────
export const chatWithAI = (model, messages, temperature, max_tokens) =>
  post('/ai/chat', { model, messages, temperature, max_tokens });

export const fetchAIModels = () =>
  get('/ai/models');
