/* ===================================================
   Marketing Activity Monitor — Meta Ads Module
   =================================================== */
'use strict';

// ── HARDCODED CONFIG ─────────────────────────────────
const META_API_VERSION = 'v20.0';
const META_BASE        = `https://graph.facebook.com/${META_API_VERSION}`;
const ROWS_PER_PAGE    = 15;

const DEFAULT_TOKEN    = 'EAAKuH4ZBXvTIBRiZBHG1DEGOoYwpZC2kuBcM1VX2zLHxg0xZAHJKZC2BuADEI02WZBEeNp5Mkzwg9hz5rZAYdtlWzGgfqSE7DpvEG6zWINZCNUX5phwzWDz1gvkHgyxv6iU3eEv2liax0JzZAZBgFq9s5RhROVHC2gTbI9naiwduZB9SY4NobuUbvYcZCz4i9IgJZB2Pr7BI1BFUhN6blFgYlC7gN09jFqlP4uyyZAOzejlZBjZC4TFIYAZCZBZAF5WOM960zaOQm1bni1c1I7N9FkZD';
const DEFAULT_ACCOUNT  = '382301253961825';

// Two ad account groups shown in the account switcher
const AD_ACCOUNTS = [
  { id: '382301253961825', label: 'Regular Ads',  adId: '658703572347941' },
  { id: '382301253961825', label: 'CPAS Ads',     adId: '382301253961825' },
];

// Full insight fields — validated against v20.0 API
// landing_page_views is NOT a direct field; extracted from actions[action_type=landing_page_view]
const INSIGHT_FIELDS = [
  'campaign_id','campaign_name',
  'spend','reach','frequency',
  'impressions','cpm',
  'inline_link_clicks',           // Klik tautan
  'clicks',                       // Klik (semua)
  'ctr',                          // CTR (semua)
  'cost_per_inline_link_click',   // CPC tautan
  'cost_per_unique_click',        // CPC semua
  'cpc',
  'actions',                      // contains landing_page_view, purchase, lead, etc
  'cost_per_action_type',
  'quality_ranking',
  'engagement_rate_ranking',
  'conversion_rate_ranking',
].join(',');

// ── STATE ────────────────────────────────────────────
const state = {
  token:              DEFAULT_TOKEN,
  accountId:          DEFAULT_ACCOUNT,
  accountName:        '',
  accountCurrency:    'IDR',
  activeAdGroup:      'Regular Ads',
  campaigns:          [],
  filteredCampaigns:  [],
  insightMap:         {},
  campaignMeta:       {},   // id -> campaign fields
  currentPage:        1,
  sortKey:            'spend',
  sortDir:            'desc',
  dateRange:          'last_7d',
  drawerCampaignId:   null,
  drawerTab:          'adsets',
  _dailyData:         [],
  _campaignInsights:  [],
  drawerAdsets: [], // Tambahkan ini agar tidak undefined
  drawerAds:    [], // Tambahkan ini agar tidak undefined
};

const COLUMN_CONFIG = {
  name:        { label: 'Kampanye',     isNum: false },
  status:      { label: 'Penayangan',   isNum: false },
  reach:       { label: 'Jangkauan',    isNum: true  },
  spend:       { label: 'Jumlah Dibelanjakan', isNum: true },
  impressions: { label: 'Impresi',      isNum: true  },
  cpm:         { label: 'CPM',          isNum: true  },
  clicks:      { label: 'Klik (Semua)', isNum: true  },
  ctr:         { label: 'CTR (Semua)',  isNum: true  },
  cpc:         { label: 'CPC (Semua)',  isNum: true  },
  detail:      { label: 'Detail',       isNum: false }
};

// Urutan kolom yang ingin ditampilkan
const ACTIVE_COLUMNS = ['name', 'status', 'reach', 'spend', 'impressions', 'cpm', 'clicks', 'ctr', 'cpc', 'detail'];

// ── DOM REFS ─────────────────────────────────────────
const $ = id => document.getElementById(id);
const dom = {
  sidebar:           $('sidebar'),
  sidebarToggle:     $('sidebarToggle'),
  dateRange:         $('dateRange'),
  btnRefresh:        $('btnRefresh'),
  lastUpdated:       $('lastUpdated'),
  // account bar
  accountBar:        $('accountBar'),
  accountName:       $('accountName'),
  accountIdDisplay:  $('accountIdDisplay'),
  adGroupTabs:       $('adGroupTabs'),
  // summary cards
  // summaryCards:      $('summaryCards'),
  // charts
  // chartsRow:         $('chartsRow'),
  // table
  tableCard:         $('tableCard'),
  searchCampaign:    $('searchCampaign'),
  filterStatus:      $('filterStatus'),
  btnExportCSV:      $('btnExportCSV'),
  campaignTableBody: $('campaignTableBody'),
  tableInfo:         $('tableInfo'),
  pagination:        $('pagination'),
  // drawer
  drawerOverlay:     $('drawerOverlay'),
  adsetDrawer:       $('adsetDrawer'),
  drawerTitle:       $('drawerTitle'),
  drawerSubtitle:    $('drawerSubtitle'),
  drawerBody:        $('drawerBody'),
  btnCloseDrawer:    $('btnCloseDrawer'),
  // misc
  loadingOverlay:    $('loadingOverlay'),
  loadingText:       $('loadingText'),
  errorBanner:       $('errorBanner'),
  errorMessage:      $('errorMessage'),
  btnDismissError:   $('btnDismissError'),
};

// ── HELPERS ──────────────────────────────────────────
function fmtCurrency(val, currency) {
  const n = parseFloat(val) || 0;
  const cur = currency || state.accountCurrency || 'IDR';
  if (cur === 'IDR') return 'Rp\u00a0' + n.toLocaleString('id-ID', { maximumFractionDigits: 0 });
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n);
}

function fmtNumber(val) {
  const n = parseFloat(val) || 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString('id-ID');
}

function fmtPct(val) { return (parseFloat(val) || 0).toFixed(2) + '%'; }

function getDatePreset(range) {
  const today = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  const sub = (d, n) => { const x = new Date(d); x.setDate(x.getDate() - n); return x; };
  switch (range) {
    case 'today':      return { since: fmt(today), until: fmt(today) };
    case 'yesterday':  return { since: fmt(sub(today,1)), until: fmt(sub(today,1)) };
    case 'last_7d':    return { since: fmt(sub(today,6)), until: fmt(today) };
    case 'last_30d':   return { since: fmt(sub(today,29)), until: fmt(today) };
    case 'this_month': { const s = new Date(today.getFullYear(), today.getMonth(), 1); return { since: fmt(s), until: fmt(today) }; }
    case 'last_month': { const s = new Date(today.getFullYear(), today.getMonth()-1, 1); const e = new Date(today.getFullYear(), today.getMonth(), 0); return { since: fmt(s), until: fmt(e) }; }
    default:           return { since: fmt(sub(today,6)), until: fmt(today) };
  }
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showError(msg) {
  dom.errorMessage.textContent = msg;
  dom.errorBanner.style.display = 'flex';
  setTimeout(() => dom.errorBanner.style.display = 'none', 10000);
}

function showLoading(text = 'Mengambil data dari Meta API...') {
  dom.loadingText.textContent = text;
  dom.loadingOverlay.style.display = 'flex';
}

function hideLoading() { dom.loadingOverlay.style.display = 'none'; }

// Extract action value by type
function getAction(actions, type) {
  if (!Array.isArray(actions)) return 0;
  const a = actions.find(x => x.action_type === type);
  return a ? parseFloat(a.value) || 0 : 0;
}

function getCostPerAction(costArr, type) {
  if (!Array.isArray(costArr)) return 0;
  const a = costArr.find(x => x.action_type === type);
  return a ? parseFloat(a.value) || 0 : 0;
}


// ── META API ─────────────────────────────────────────
async function metaFetch(path, params = {}) {
  const url = new URL(`${META_BASE}${path}`);
  url.searchParams.set('access_token', state.token);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.error) throw new Error(`[${json.error.code}] ${json.error.message}`);
  return json;
}

async function fetchAllPages(path, params = {}) {
  let results = [];
  let data = await metaFetch(path, params);
  results = results.concat(data.data || []);
  while (data.paging && data.paging.next) {
    // next URL is a full URL — fetch it directly with just the token appended
    const nextUrl = new URL(data.paging.next);
    nextUrl.searchParams.set('access_token', state.token);
    const res = await fetch(nextUrl.toString());
    data = await res.json();
    if (data.error) throw new Error(`[${data.error.code}] ${data.error.message}`);
    results = results.concat(data.data || []);
  }
  return results;
}

async function fetchAccount(accountId) {
  return metaFetch(`/act_${accountId}`, { fields: 'name,currency,account_status,timezone_name' });
}

async function fetchCampaigns(accountId) {
  return fetchAllPages(`/act_${accountId}/campaigns`, {
    fields: 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,budget_remaining',
    limit: 100,
  });
}

async function fetchCampaignInsights(accountId, datePreset) {
  const { since, until } = datePreset;
  return fetchAllPages(`/act_${accountId}/insights`, {
    fields: INSIGHT_FIELDS,
    time_range: JSON.stringify({ since, until }),
    level: 'campaign',
    limit: 100,
  });
}

async function fetchAccountInsights(accountId, datePreset) {
  const { since, until } = datePreset;
  return metaFetch(`/act_${accountId}/insights`, {
    fields: 'spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,cost_per_action_type,inline_link_clicks',
    time_range: JSON.stringify({ since, until }),
    level: 'account',
  });
}

async function fetchDailyInsights(accountId, datePreset) {
  const { since, until } = datePreset;
  return fetchAllPages(`/act_${accountId}/insights`, {
    fields: 'spend,clicks,impressions,reach,date_start',
    time_range: JSON.stringify({ since, until }),
    time_increment: 1,
    level: 'account',
    limit: 90,
  });
}

async function fetchAdSets(campaignId, datePreset) {
  const { since, until } = datePreset;
  const [adsets, insights] = await Promise.all([
    fetchAllPages(`/${campaignId}/adsets`, {
      fields: 'id,name,status,daily_budget,lifetime_budget,optimization_goal,billing_event',
      limit: 50,
    }),
    fetchAllPages(`/${campaignId}/insights`, {
      fields: 'adset_id,spend,impressions,clicks,ctr,cpc,reach,frequency,actions,inline_link_clicks',
      time_range: JSON.stringify({ since, until }),
      level: 'adset', limit: 50,
    }),
  ]);
  const iMap = {};
  insights.forEach(i => { iMap[i.adset_id] = i; });
  return adsets.map(a => ({ ...a, ins: iMap[a.id] || {} }));
}

async function fetchAds(campaignId, datePreset) {
  const { since, until } = datePreset;
  const [ads, insights] = await Promise.all([
    fetchAllPages(`/${campaignId}/ads`, {
      fields: 'id,name,status,creative{title,body,thumbnail_url}',
      limit: 50,
    }),
    fetchAllPages(`/${campaignId}/insights`, {
      fields: 'ad_id,spend,impressions,clicks,ctr,cpc,reach,actions,inline_link_clicks',
      time_range: JSON.stringify({ since, until }),
      level: 'ad', limit: 50,
    }),
  ]);
  const iMap = {};
  insights.forEach(i => { iMap[i.ad_id] = i; });
  return ads.map(a => ({ ...a, ins: iMap[a.id] || {} }));
}


// ── CHARTS ───────────────────────────────────────────
function drawLineChart(canvasId, labels, datasets) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.parentElement.clientWidth - 40 || 600;
  const H = 240;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const PAD = { top: 24, right: 24, bottom: 44, left: 68 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const n = labels.length;
  if (n === 0) return;

  ctx.clearRect(0, 0, W, H);

  // grid
  const gridN = 5;
  for (let i = 0; i <= gridN; i++) {
    const y = PAD.top + cH - (i / gridN) * cH;
    ctx.strokeStyle = '#1e2535'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cW, y); ctx.stroke();
  }

  datasets.forEach((ds, di) => {
    const max = Math.max(...ds.data.map(Number), 1);
    // y-axis labels for first dataset
    if (di === 0) {
      for (let i = 0; i <= gridN; i++) {
        const y = PAD.top + cH - (i / gridN) * cH;
        ctx.fillStyle = '#64748b'; ctx.font = '11px Segoe UI,sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(fmtNumber(max * i / gridN), PAD.left - 6, y + 4);
      }
    }

    const pts = ds.data.map((v, i) => ({
      x: PAD.left + (n > 1 ? i / (n - 1) : 0.5) * cW,
      y: PAD.top + cH - (Number(v) / max) * cH,
    }));

    // gradient fill
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + cH);
    grad.addColorStop(0, ds.color + '35'); grad.addColorStop(1, ds.color + '00');
    ctx.beginPath();
    ctx.moveTo(pts[0].x, PAD.top + cH);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length-1].x, PAD.top + cH);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

    // line
    ctx.beginPath(); ctx.strokeStyle = ds.color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();

    // dots
    pts.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI*2);
      ctx.fillStyle = ds.color; ctx.fill();
      ctx.strokeStyle = '#0f1117'; ctx.lineWidth = 1.5; ctx.stroke();
    });
  });

  // x labels
  const step = n > 14 ? Math.ceil(n / 7) : 1;
  ctx.fillStyle = '#64748b'; ctx.font = '11px Segoe UI,sans-serif'; ctx.textAlign = 'center';
  for (let i = 0; i < n; i += step) {
    const x = PAD.left + (n > 1 ? i / (n - 1) : 0.5) * cW;
    ctx.fillText(labels[i], x, PAD.top + cH + 18);
  }
}

function drawDonutChart(canvasId, labels, values, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const S = 260;
  canvas.width = S * dpr; canvas.height = S * dpr;
  canvas.style.width = S + 'px'; canvas.style.height = S + 'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, S, S);

  const total = values.reduce((a, b) => a + b, 0) || 1;
  const cx = S / 2, cy = S / 2 - 14;
  const R = 90, r = 54;
  let angle = -Math.PI / 2;

  values.forEach((v, i) => {
    const slice = (v / total) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length]; ctx.fill();
    ctx.strokeStyle = '#0f1117'; ctx.lineWidth = 2; ctx.stroke();
    angle += slice;
  });

  // hole
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.fillStyle = '#161b27'; ctx.fill();

  // center label
  ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'center';
  ctx.font = 'bold 14px Segoe UI,sans-serif';
  ctx.fillText(values.length + ' Campaign', cx, cy + 5);

  // legend
  const legY = cy + R + 18;
  ctx.font = '11px Segoe UI,sans-serif';
  const maxL = Math.min(labels.length, 6);
  for (let i = 0; i < maxL; i++) {
    const col = i % 2, row = Math.floor(i / 2);
    const lx = 8 + col * (S / 2);
    const ly = legY + row * 18;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(lx, ly - 8, 10, 10);
    ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    const lbl = labels[i].length > 15 ? labels[i].slice(0, 14) + '…' : labels[i];
    ctx.fillText(lbl, lx + 14, ly);
  }
}


// ── RENDER SUMMARY CARDS ─────────────────────────────
function renderSummary(accIns, campaignInsights) {
  const d = (accIns && accIns.data && accIns.data[0]) || {};
  const cur = state.accountCurrency;

  // landing_page_view lives inside actions array
  const totalLPV = campaignInsights.reduce((sum, ci) => {
    return sum + getAction(ci.actions, 'landing_page_view');
  }, 0);
  const totalLinkClicks = campaignInsights.reduce((sum, ci) => sum + (parseFloat(ci.inline_link_clicks) || 0), 0);
  const totalSpend = parseFloat(d.spend) || 0;
  const costPerLPV = totalLPV > 0 ? totalSpend / totalLPV : 0;
  // account-level LPV from actions
  const accLPV = getAction(d.actions, 'landing_page_view');

  const cards = [
    { id: 'sc-spend',       icon: '💰', label: 'Jumlah Dibelanjakan',    val: fmtCurrency(d.spend) },
    { id: 'sc-reach',       icon: '👥', label: 'Jangkauan',              val: fmtNumber(d.reach) },
    { id: 'sc-freq',        icon: '🔁', label: 'Frekuensi',              val: (parseFloat(d.frequency)||0).toFixed(2) },
    { id: 'sc-impressions', icon: '👁', label: 'Impresi',                val: fmtNumber(d.impressions) },
    { id: 'sc-cpm',         icon: '📊', label: 'CPM',                    val: fmtCurrency(d.cpm) },
    { id: 'sc-linkclicks',  icon: '🔗', label: 'Klik Tautan',            val: fmtNumber(totalLinkClicks) },
    { id: 'sc-clicks',      icon: '🖱', label: 'Klik (Semua)',           val: fmtNumber(d.clicks) },
    { id: 'sc-ctr',         icon: '📈', label: 'CTR (Semua)',            val: fmtPct(d.ctr) },
    { id: 'sc-cpc',         icon: '🎯', label: 'CPC (Semua)',            val: fmtCurrency(d.cpc) },
    { id: 'sc-lpv',         icon: '🌐', label: 'Tayangan Halaman Tujuan',val: fmtNumber(totalLPV) },
    { id: 'sc-cplpv',       icon: '💸', label: 'Biaya per Tay. Halaman', val: fmtCurrency(costPerLPV) },
  ];

  const container = dom.summaryCards;
  container.innerHTML = cards.map(c => `
    <div class="card metric-card" id="${c.id}">
      <div class="card-icon-wrap">${c.icon}</div>
      <div class="card-body">
        <div class="card-label">${c.label}</div>
        <div class="card-value">${c.val}</div>
      </div>
    </div>
  `).join('');
  container.style.display = 'grid';
}

// ── RENDER CHARTS ─────────────────────────────────────
function renderCharts(dailyData, campaignInsights) {
  dom.chartsRow.style.display = 'grid';

  const sorted = [...dailyData].sort((a, b) => a.date_start.localeCompare(b.date_start));
  const labels     = sorted.map(d => { const dt = new Date(d.date_start); return (dt.getMonth()+1)+'/'+dt.getDate(); });
  const spendData  = sorted.map(d => parseFloat(d.spend) || 0);
  const reachData  = sorted.map(d => parseFloat(d.reach) || 0);

  drawLineChart('chartSpendClicks', labels, [
    { data: spendData, color: '#4f46e5', label: 'Spend' },
    { data: reachData, color: '#06b6d4', label: 'Reach' },
  ]);

  const top = [...campaignInsights].sort((a,b) => parseFloat(b.spend)-parseFloat(a.spend)).slice(0,6);
  drawDonutChart('chartCampaignPie',
    top.map(c => c.campaign_name || 'Campaign'),
    top.map(c => parseFloat(c.spend) || 0),
    ['#4f46e5','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6']
  );
}


// ── RENDER TABLE ──────────────────────────────────────
function buildCampaignRow(c) {
  const ins = state.insightMap[c.id] || {};
  const meta = state.campaignMeta[c.id] || c;
  const cur = state.accountCurrency;

  // Derived metrics
  const spend        = parseFloat(ins.spend) || 0;
  const impressions  = parseFloat(ins.impressions) || 0;
  const reach        = parseFloat(ins.reach) || 0;
  const frequency    = parseFloat(ins.frequency) || 0;
  const cpm          = parseFloat(ins.cpm) || 0;
  const linkClicks   = parseFloat(ins.inline_link_clicks) || 0;
  const clicks       = parseFloat(ins.clicks) || 0;
  const ctr          = parseFloat(ins.ctr) || 0;
  const cpcLink      = parseFloat(ins.cost_per_inline_link_click) || 0;
  const cpc = parseFloat(ins.cpc) || 0;
  const cpcAll       = parseFloat(ins.cost_per_unique_click) || 0;
  // landing_page_view from actions array (not a direct field)
  const lpv          = getAction(ins.actions, 'landing_page_view');
  const costPerLPV   = lpv > 0 ? spend / lpv : 0;

  // Actions: purchase / lead / add_to_cart
  const purchases    = getAction(ins.actions, 'purchase') || getAction(ins.actions, 'offsite_conversion.fb_pixel_purchase');
  const leads        = getAction(ins.actions, 'lead') || getAction(ins.actions, 'offsite_conversion.fb_pixel_lead');
  const addToCart    = getAction(ins.actions, 'add_to_cart') || getAction(ins.actions, 'offsite_conversion.fb_pixel_add_to_cart');
  const totalActions = purchases + leads + addToCart;
  const costPerResult = totalActions > 0 ? spend / totalActions : 0;

  // Budget
  const budget = meta.daily_budget
    ? fmtCurrency(parseFloat(meta.daily_budget)/100, cur) + '/hari'
    : meta.lifetime_budget
      ? fmtCurrency(parseFloat(meta.lifetime_budget)/100, cur) + ' lifetime'
      : '—';

  // Schedule
  const startDate = meta.start_time ? new Date(meta.start_time).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '—';
  const stopDate  = meta.stop_time  ? new Date(meta.stop_time).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : 'Berkelanjutan';

  // Rankings
  const qRank  = ins.quality_ranking           || '—';
  const erRank = ins.engagement_rate_ranking   || '—';
  const crRank = ins.conversion_rate_ranking   || '—';

  return {
    id: c.id, name: c.name, status: c.status,
    objective: c.objective || '—',
    spend, impressions, reach, frequency, cpm,cpc:cpc,
    linkClicks, clicks, ctr, cpcLink, cpcAll, lpv, costPerLPV,
    totalActions, costPerResult,
    budget, startDate, stopDate,
    qRank, erRank, crRank,
    _raw: { spend, impressions, clicks, ctr, cpcAll, cpcLink, reach, frequency, linkClicks, lpv, costPerResult, costPerLPV, cpm, cpc:cpc },
  };
}

function applyFiltersAndSort() {
  const search = dom.searchCampaign.value.toLowerCase();
  const statusFilter = dom.filterStatus.value;

  let list = state.campaigns.map(buildCampaignRow);
  if (search) list = list.filter(c => c.name.toLowerCase().includes(search));
  if (statusFilter) list = list.filter(c => c.status === statusFilter);

  list.sort((a, b) => {
    let va = a._raw[state.sortKey] ?? a[state.sortKey];
    let vb = b._raw[state.sortKey] ?? b[state.sortKey];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return state.sortDir === 'asc' ? -1 : 1;
    if (va > vb) return state.sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  state.filteredCampaigns = list;
  state.currentPage = 1;
  renderTablePage();
}

function rankBadge(val) {
  if (!val || val === '—') return '<span class="rank-badge unknown">—</span>';
  const cls = val.includes('ABOVE') ? 'above' : val.includes('BELOW') ? 'below' : 'avg';
  const label = val.replace(/_/g,' ').replace('AVERAGE','AVG').replace('ABOVE AVERAGE','↑ ABOVE').replace('BELOW AVERAGE','↓ BELOW');
  return `<span class="rank-badge ${cls}">${label}</span>`;
}

function renderTablePage() {
  const list = state.filteredCampaigns;
  const cur  = state.accountCurrency;
  dom.tableCard.style.display = 'flex';

  // Render Header dinamis
  document.querySelector('#campaignTable thead tr').innerHTML = ACTIVE_COLUMNS.map(key => 
    `<th>${COLUMN_CONFIG[key].label}</th>`
  ).join('');

  // Render Body dinamis
  dom.campaignTableBody.innerHTML = list.map(c => `
    <tr>
      ${ACTIVE_COLUMNS.map(key => {
        if (key === 'name') return `<td class="col-sticky"><div class="campaign-name">${escHtml(c.name)}</div></td>`;
        if (key === 'status') return `<td><span class="status-badge ${c.status}">${c.status}</span></td>`;
        if (key === 'detail') return `<td><button class="btn-detail" data-id="${c.id}" data-name="${escHtml(c.name)}">▶ Detail</button></td>`;
        
        // Data angka
        const val = c._raw[key] ?? c[key] ?? 0;
        const formatted = key.includes('spend') || key.includes('cpm') || key.includes('cpc') ? fmtCurrency(val, cur) : 
                          key.includes('ctr') ? fmtPct(val) : fmtNumber(val);
        return `<td class="num">${formatted}</td>`;
      }).join('')}
    </tr>
  `).join('');
}


// ── DRAWER ────────────────────────────────────────────
function openDrawer(campaignId, campaignName) {
  state.drawerCampaignId = campaignId;
  dom.drawerTitle.textContent = campaignName;
  dom.drawerSubtitle.textContent = 'ID: ' + campaignId;
  dom.adsetDrawer.classList.add('open');
  dom.drawerOverlay.classList.add('open');
  document.querySelectorAll('.drawer-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'adsets'));
  loadDrawerTab('adsets');
}

function closeDrawer() {
  dom.adsetDrawer.classList.remove('open');
  dom.drawerOverlay.classList.remove('open');
}

async function loadDrawerTab(tabType) {
  state.drawerTab = tabType;
  
  // 1. Tampilkan indikator loading di drawer body
  dom.drawerBody.innerHTML = `<div style="text-align:center;padding:48px"><div class="spinner" style="margin:0 auto 14px"></div><p>Memuat data...</p></div>`;
  
  const dp = getDatePreset(state.dateRange);
  const cur = state.accountCurrency;
  
  try {
    let data = [];
    if (tabType === 'adsets') {
      // Pastikan hasil fetch dimasukkan ke dalam state
      state.drawerAdsets = await fetchAdSets(state.drawerCampaignId, dp);
      data = state.drawerAdsets;
    } else {
      state.drawerAds = await fetchAds(state.drawerCampaignId, dp);
      data = state.drawerAds;
    }

    // 2. CEK: Jika data masih undefined atau kosong
    if (!data || !Array.isArray(data)) {
      dom.drawerBody.innerHTML = emptyState('Tidak ada data ditemukan');
      return;
    }

    // 3. Render Tabel (menggunakan array 'data' yang sudah dipastikan valid)
    let html = `
      <table class="drawer-table">
        <thead>
          <tr>${ACTIVE_COLUMNS.map(key => `<th>${COLUMN_CONFIG[key].label}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${data.map(item => `
            <tr>
              ${ACTIVE_COLUMNS.map(key => {
                if (key === 'name') return `<td class="col-sticky">${escHtml(item.name || '-')}</td>`;
                if (key === 'status') return `<td><span class="status-badge ${item.status}">${item.status || 'N/A'}</span></td>`;
                if (key === 'detail') return `<td>-</td>`;

                if (key === 'cpc') {
                  const val = (item.ins && item.ins.cpc) ? parseFloat(item.ins.cpc) : (parseFloat(item.cpc) || 0);
                  return `<td class="num">${fmtCurrency(val, cur)}</td>`;
                }
                const val = (item.ins && item.ins[key]) ? item.ins[key] : (item[key] || 0);
                
                const formatted = (key === 'spend' || key === 'cpm' || key === 'cpc') ? fmtCurrency(val, cur) : 
                                  (key === 'ctr') ? fmtPct(val) : fmtNumber(val);
                return `<td class="num">${formatted}</td>`;
                
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    dom.drawerBody.innerHTML = html;

  } catch (err) {
    dom.drawerBody.innerHTML = `<p style="color:red; text-align:center;">Error: ${err.message}</p>`;
  }
}

function emptyState(msg) {
  return `<div class="empty-state"><div class="empty-icon">📭</div><p>${msg}</p></div>`;
}

// ── EXPORT CSV ────────────────────────────────────────
function exportCSV() {
  const headers = ['Campaign','Status','Objective','Spend','Impressions','Reach','Frequency','CPM','Klik Tautan','Klik Semua','CTR','CPC Tautan','CPC Semua','Tay. Halaman','Biaya/Tay. Halaman','Hasil','Biaya/Hasil','Anggaran','Mulai','Berakhir'];
  const rows = state.filteredCampaigns.map(c => [
    `"${c.name.replace(/"/g,'""')}"`, c.status, c.objective,
    c.spend.toFixed(2), c.impressions, c.reach, c.frequency.toFixed(2),
    c.cpm.toFixed(2), c.linkClicks, c.clicks, c.ctr.toFixed(2)+'%',
    c.cpcLink.toFixed(2), c.cpcAll.toFixed(2), c.lpv, c.costPerLPV.toFixed(2),
    c.totalActions, c.costPerResult.toFixed(2), `"${c.budget}"`, c.startDate, c.stopDate,
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `meta-ads-${state.dateRange}-${Date.now()}.csv`;
  a.click(); URL.revokeObjectURL(url);
}


// ── MAIN LOAD ─────────────────────────────────────────
async function loadDashboard() {
  showLoading('Menghubungkan ke Meta API...');
  const dp = getDatePreset(state.dateRange);

  try {
    showLoading('Mengambil data kampanye...');
    const [accInfo, campaigns, campaignInsights, dailyData, accInsights] = await Promise.all([
      fetchAccount(state.accountId),
      fetchCampaigns(state.accountId),
      fetchCampaignInsights(state.accountId, dp),
      fetchDailyInsights(state.accountId, dp),
      fetchAccountInsights(state.accountId, dp),
    ]);

    // Update account info
    state.accountName     = accInfo.name || 'Ad Account';
    state.accountCurrency = accInfo.currency || 'IDR';
    dom.accountName.textContent      = state.accountName;
    dom.accountIdDisplay.textContent = `act_${state.accountId} · ${state.accountCurrency}`;
    dom.accountBar.style.display = 'flex';

    // Build maps
    state.campaigns = campaigns;
    state.insightMap = {};
    state.campaignMeta = {};
    campaignInsights.forEach(ci => { state.insightMap[ci.campaign_id] = ci; });
    campaigns.forEach(c => { state.campaignMeta[c.id] = c; });

    state._dailyData        = dailyData;
    state._campaignInsights = campaignInsights;

    // renderSummary(accInsights, campaignInsights);
    // renderCharts(dailyData, campaignInsights);
    applyFiltersAndSort();

    dom.lastUpdated.textContent = 'Diperbarui: ' + new Date().toLocaleTimeString('id-ID');
    hideLoading();
  } catch (err) {
    hideLoading();
    showError('Gagal memuat data: ' + err.message);
    console.error(err);
  }
}

async function refreshData() {
  dom.btnRefresh.classList.add('spinning');
  await loadDashboard();
  dom.btnRefresh.classList.remove('spinning');
}

// ── EVENTS ────────────────────────────────────────────
function initEvents() {
  // Sidebar
  dom.sidebarToggle.addEventListener('click', () => dom.sidebar.classList.toggle('collapsed'));

  // Date range
  dom.dateRange.addEventListener('change', () => { state.dateRange = dom.dateRange.value; refreshData(); });

  // Refresh
  dom.btnRefresh.addEventListener('click', refreshData);

  // Ad group tabs
  dom.adGroupTabs.addEventListener('click', e => {
    const btn = e.target.closest('.adgroup-tab');
    if (!btn) return;
    document.querySelectorAll('.adgroup-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    state.activeAdGroup = btn.dataset.group;
    // Both groups use same account; filter by ad ID if needed
    applyFiltersAndSort();
  });

  // Search & filter
  dom.searchCampaign.addEventListener('input', applyFiltersAndSort);
  dom.filterStatus.addEventListener('change', applyFiltersAndSort);

  // Export
  dom.btnExportCSV.addEventListener('click', exportCSV);

  // Table sort headers
  document.querySelectorAll('#campaignTable thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      state.sortDir = state.sortKey === key ? (state.sortDir === 'asc' ? 'desc' : 'asc') : 'desc';
      state.sortKey = key;
      document.querySelectorAll('#campaignTable thead th').forEach(t => t.classList.remove('sort-asc','sort-desc'));
      th.classList.add(state.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      applyFiltersAndSort();
    });
  });

  // Table detail (delegated)
  dom.campaignTableBody.addEventListener('click', e => {
    const btn = e.target.closest('.btn-detail');
    if (btn) openDrawer(btn.dataset.id, btn.dataset.name);
  });

  // Drawer tabs
  document.querySelectorAll('.drawer-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.drawer-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadDrawerTab(tab.dataset.tab);
    });
  });

  // Close drawer
  dom.btnCloseDrawer.addEventListener('click', closeDrawer);
  dom.drawerOverlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  // Dismiss error
  dom.btnDismissError.addEventListener('click', () => dom.errorBanner.style.display = 'none');

  // Resize redraw
  // let resizeTimer;
  // window.addEventListener('resize', () => {
  //   clearTimeout(resizeTimer);
  //   resizeTimer = setTimeout(() => {
  //     if (state._dailyData.length) renderCharts(state._dailyData, state._campaignInsights);
  //   }, 300);
  // });
}

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initEvents();
  loadDashboard();
});

