/**
 * Frontend config — NO secrets here.
 * All sensitive calls go through the backend proxy at /api/*
 */

// Injected by Vite at build time from vite.config.js define block
export const API_BASE = typeof __API_BASE__ !== 'undefined'
  ? __API_BASE__
  : '/api';

// Fallback Meta token — injected from root .env at build time
// Never hardcode secrets here; this value comes from VITE_META_FALLBACK_TOKEN
export const FALLBACK_TOKEN = typeof __FALLBACK_TOKEN__ !== 'undefined'
  ? __FALLBACK_TOKEN__
  : '';

// Meta ad accounts
export const AD_GROUPS = {
  'Regular Ads': '658703572347941',
  'CPAS Ads':    '382301253961825',
};

export const DEFAULT_ACCOUNT = '658703572347941';

export const ROWS_PER_PAGE = 15;

export const META_API_VERSION = 'v20.0';

// localStorage keys for token persistence
export const LS_TOKEN  = 'mam_meta_token';
export const LS_EXPIRY = 'mam_meta_token_expiry';
export const LS_TYPE   = 'mam_meta_token_type';

export const TOKEN_WARN_DAYS    = 7;
export const TOKEN_REFRESH_DAYS = 3;

// Insight fields — base (semua akun)
export const INSIGHT_FIELDS_BASE = [
  'campaign_id', 'campaign_name',
  'spend', 'reach', 'frequency',
  'impressions', 'cpm',
  'inline_link_clicks',
  'clicks', 'ctr',
  'cost_per_inline_link_click',
  'cost_per_unique_click', 'cpc',
  'actions', 'action_values',
  'cost_per_action_type',
  'quality_ranking',
  'engagement_rate_ranking',
  'conversion_rate_ranking',
].join(',');

// CPAS insight fields — tambah catalog_segment fields
export const INSIGHT_FIELDS_CPAS = [
  'campaign_id', 'campaign_name',
  'spend', 'reach', 'frequency',
  'impressions', 'cpm',
  'inline_link_clicks',
  'clicks', 'ctr',
  'cost_per_inline_link_click',
  'cost_per_unique_click', 'cpc',
  'actions', 'action_values',
  'cost_per_action_type',
  'quality_ranking',
  'engagement_rate_ranking',
  'conversion_rate_ranking',
  'catalog_segment_actions',
  'catalog_segment_value',
  'catalog_segment_value_omni_purchase_roas',
].join(',');

// Alias untuk backward compat
export const INSIGHT_FIELDS = INSIGHT_FIELDS_BASE;

export const COLUMN_CONFIG = {
  name:                { label: 'Kampanye',                                         isNum: false },
  status:              { label: 'Penayangan',                                       isNum: false },
  reach:               { label: 'Jangkauan',                                        isNum: true  },
  spend:               { label: 'Jumlah Dibelanjakan',                              isNum: true  },
  impressions:         { label: 'Impresi',                                          isNum: true  },
  cpm:                 { label: 'CPM',                                              isNum: true  },
  clicks:              { label: 'Klik (Semua)',                                     isNum: true  },
  ctr:                 { label: 'CTR (Semua)',                                      isNum: true  },
  cpc:                 { label: 'CPC (Semua)',                                      isNum: true  },
  // CPAS-only columns
  cpas_purchase:       { label: 'Pembelian Item Bersama',                           isNum: true  },
  cpas_purchase_value: { label: 'Nilai Konversi Pembelian Item Bersama',            isNum: true  },
  cpas_atc:            { label: 'Tambah ke Keranjang Item Bersama',                 isNum: true  },
  cpas_atc_value:      { label: 'Nilai Konversi Keranjang Item Bersama',            isNum: true  },
  cpas_roas:           { label: 'ROAS Pembelian Item Bersama',                      isNum: true  },
  cpas_cost_per_conv:  { label: 'Biaya per Konversi',                              isNum: true  },
  detail:              { label: 'Detail',                                           isNum: false },
};

export const ACTIVE_COLUMNS_REGULAR = [
  'name', 'status', 'reach', 'spend',
  'impressions', 'cpm', 'clicks', 'ctr', 'cpc',
];

export const ACTIVE_COLUMNS_CPAS = [
  'name', 'status', 'reach', 'spend',
  'impressions', 'cpm', 'clicks', 'ctr', 'cpc',
  'cpas_purchase', 'cpas_purchase_value',
  'cpas_atc', 'cpas_atc_value',
  'cpas_roas', 'cpas_cost_per_conv',
];

// Alias — akan dioverride di app.js sesuai tab aktif
export const ACTIVE_COLUMNS = ACTIVE_COLUMNS_REGULAR;

export const AI_MODELS = [
  { id: 'gpt-5-chat',         label: 'GPT-5 Chat ✓'    },
  { id: 'gpt-3.5-turbo-0613', label: 'GPT-3.5 Turbo ✓' },
];

export const AI_DEFAULT_MODEL = 'gpt-5-chat';
