/**
 * Marketing Activity Monitor — Meta Ads Module
 * All API calls go through /api/* (backend proxy).
 * No secrets in this file.
 */
import {
  AD_GROUPS, DEFAULT_ACCOUNT, ROWS_PER_PAGE,
  LS_TOKEN, LS_EXPIRY, LS_TYPE,
  TOKEN_WARN_DAYS, TOKEN_REFRESH_DAYS,
  COLUMN_CONFIG, ACTIVE_COLUMNS_REGULAR, ACTIVE_COLUMNS_CPAS,
} from './lib/config.js';

import {
  setToken, getToken,
  inspectToken, extendToken,
  fetchAccount, fetchCampaigns,
  fetchCampaignInsights, fetchAccountInsights,
  fetchDailyInsights, fetchAdSets, fetchAds,
} from './lib/api.js';

import {
  fmtCurrency, fmtNumber, fmtPct,
  getDatePreset, escHtml, getAction,
} from './lib/helpers.js';

// ── STATE ─────────────────────────────────────────────
export const state = {
  accountId:         DEFAULT_ACCOUNT,
  accountName:       '',
  accountCurrency:   'IDR',
  activeAdGroup:     'Regular Ads',
  campaigns:         [],
  filteredCampaigns: [],
  insightMap:        {},
  campaignMeta:      {},
  currentPage:       1,
  sortKey:           'spend',
  sortDir:           'desc',
  dateRange:         'last_7d',
  drawerCampaignId:  null,
  drawerTab:         'adsets',
  _dailyData:        [],
  _campaignInsights: [],
};

// ── DOM ───────────────────────────────────────────────
const $   = id => document.getElementById(id);
const dom = {
  sidebar:           $('sidebar'),
  sidebarToggle:     $('sidebarToggle'),
  dateRange:         $('dateRange'),
  btnRefresh:        $('btnRefresh'),
  lastUpdated:       $('lastUpdated'),
  accountBar:        $('accountBar'),
  accountName:       $('accountName'),
  accountIdDisplay:  $('accountIdDisplay'),
  adGroupTabs:       $('adGroupTabs'),
  tableCard:         $('tableCard'),
  searchCampaign:    $('searchCampaign'),
  filterStatus:      $('filterStatus'),
  btnExportCSV:      $('btnExportCSV'),
  campaignTableBody: $('campaignTableBody'),
  tableInfo:         $('tableInfo'),
  pagination:        $('pagination'),
  drawerOverlay:     $('drawerOverlay'),
  adsetDrawer:       $('adsetDrawer'),
  drawerTitle:       $('drawerTitle'),
  drawerSubtitle:    $('drawerSubtitle'),
  drawerBody:        $('drawerBody'),
  btnCloseDrawer:    $('btnCloseDrawer'),
  loadingOverlay:    $('loadingOverlay'),
  loadingText:       $('loadingText'),
  errorBanner:       $('errorBanner'),
  errorMessage:      $('errorMessage'),
  btnDismissError:   $('btnDismissError'),
};

// ── UI HELPERS ────────────────────────────────────────
export function showError(msg) {
  dom.errorMessage.textContent = msg;
  dom.errorBanner.style.display = 'flex';
  setTimeout(() => dom.errorBanner.style.display = 'none', 10000);
}

export function showLoading(text = 'Mengambil data...') {
  dom.loadingText.textContent = text;
  dom.loadingOverlay.style.display = 'flex';
}

export function hideLoading() {
  dom.loadingOverlay.style.display = 'none';
}

// ── TOKEN MANAGER ─────────────────────────────────────
export const TokenManager = {
  save(token, expiresInSeconds, type = 'long') {
    const expiry = Date.now() + expiresInSeconds * 1000;
    localStorage.setItem(LS_TOKEN,  token);
    localStorage.setItem(LS_EXPIRY, String(expiry));
    localStorage.setItem(LS_TYPE,   type);
    setToken(token);
    this.updateUI();
  },

  load() {
    const token  = localStorage.getItem(LS_TOKEN);
    const expiry = parseInt(localStorage.getItem(LS_EXPIRY) || '0', 10);
    const type   = localStorage.getItem(LS_TYPE) || 'short';
    return token ? { token, expiry, type } : null;
  },

  daysLeft(expiry) {
    return Math.max(0, (expiry - Date.now()) / (1000 * 60 * 60 * 24));
  },

  async doExtend(token) {
    const data = await extendToken(token);        // calls backend /api/meta/token/extend
    const expiresIn = data.expires_in || 5183944;
    this.save(data.access_token, expiresIn, 'long');
    return data.access_token;
  },

  async init(fallbackToken) {
    const stored = this.load();
    let token    = stored?.token || fallbackToken;

    try {
      this.updateUI({ status: 'checking' });
      const info = await inspectToken(token);     // calls backend /api/meta/token/inspect

      if (!info.is_valid) {
        token = fallbackToken;
        token = await this.doExtend(token);
        this.updateUI({ status: 'extended' });
        return token;
      }

      const expiresAt = info.expires_at ? info.expires_at * 1000 : (stored?.expiry || 0);
      const days      = this.daysLeft(expiresAt);

      localStorage.setItem(LS_TOKEN,  token);
      localStorage.setItem(LS_EXPIRY, String(expiresAt || Date.now() + 60 * 86400000));
      localStorage.setItem(LS_TYPE,   info.type === 'USER' ? 'long' : 'short');
      setToken(token);

      if (days <= TOKEN_REFRESH_DAYS) {
        token = await this.doExtend(token);
        this.updateUI({ status: 'extended' });
        return token;
      }

      this.updateUI({ days, status: days <= TOKEN_WARN_DAYS ? 'warn' : 'ok' });
      return token;
    } catch (err) {
      console.warn('Token check failed:', err.message);
      setToken(token);
      this.updateUI({ status: 'unknown' });
      return token;
    }
  },

  async manualExtend() {
    const btn = $('btnExtendToken');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Memperpanjang...'; }
    try {
      const stored  = this.load();
      const current = stored?.token || getToken();
      await this.doExtend(current);
      this.updateUI({ status: 'extended' });
      if (btn) btn.textContent = '✅ Berhasil';
      setTimeout(() => { if (btn) { btn.disabled = false; btn.textContent = '🔄 Perpanjang'; } }, 3000);
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Perpanjang'; }
      showError('Gagal perpanjang token: ' + err.message);
    }
  },

  updateUI({ days, status } = {}) {
    const el = $('tokenStatus');
    if (!el) return;
    const stored = this.load();
    const d      = days ?? (stored ? Math.floor(this.daysLeft(stored.expiry)) : null);
    const cfgs   = {
      ok:       { cls: 'token-ok',      icon: '🔑', text: `Token OK · ${d}h lagi`                },
      warn:     { cls: 'token-warn',    icon: '⚠️', text: `Token ${d}h lagi · Segera perpanjang` },
      extended: { cls: 'token-ok',      icon: '✅', text: 'Token diperpanjang (60 hari)'          },
      checking: { cls: 'token-check',   icon: '⏳', text: 'Memeriksa token...'                    },
      unknown:  { cls: 'token-unknown', icon: '❓', text: 'Status token tidak diketahui'           },
    };
    const cfg = cfgs[status] || cfgs.ok;
    el.className = 'token-status ' + cfg.cls;
    el.innerHTML = `
      <span class="token-icon">${cfg.icon}</span>
      <span class="token-text">${cfg.text}</span>
      <button class="btn-extend-token" id="btnExtendToken">🔄 Perpanjang</button>`;
    $('btnExtendToken')?.addEventListener('click', () => this.manualExtend());
  },
};

// ── RENDER TABLE ──────────────────────────────────────
function getActiveColumns() {
  return state.activeAdGroup === 'CPAS Ads' ? ACTIVE_COLUMNS_CPAS : ACTIVE_COLUMNS_REGULAR;
}

function getActionValue(actionValues, type) {
  if (!Array.isArray(actionValues)) return 0;
  const a = actionValues.find(x => x.action_type === type);
  return a ? parseFloat(a.value) || 0 : 0;
}

function buildRow(c) {
  const ins  = state.insightMap[c.id]   || {};
  const cur  = state.accountCurrency;

  const spend       = parseFloat(ins.spend) || 0;
  const impressions = parseFloat(ins.impressions) || 0;
  const reach       = parseFloat(ins.reach) || 0;
  const frequency   = parseFloat(ins.frequency) || 0;
  const cpm         = parseFloat(ins.cpm) || 0;
  const clicks      = parseFloat(ins.clicks) || 0;
  const ctr         = parseFloat(ins.ctr) || 0;
  const cpc         = parseFloat(ins.cpc) || 0;
  const lpv         = getAction(ins.actions, 'landing_page_view');

  const purchases      = getAction(ins.actions, 'purchase') || getAction(ins.actions, 'offsite_conversion.fb_pixel_purchase');
  const leads          = getAction(ins.actions, 'lead')     || getAction(ins.actions, 'offsite_conversion.fb_pixel_lead');
  const atc            = getAction(ins.actions, 'add_to_cart') || getAction(ins.actions, 'offsite_conversion.fb_pixel_add_to_cart');
  const totalActions   = purchases + leads + atc;
  const costPerResult  = totalActions > 0 ? spend / totalActions : 0;
  const costPerLPV     = lpv > 0 ? spend / lpv : 0;

  // CPAS "item bersama" metrics — dari catalog_segment_actions / catalog_segment_value
  const catActions = ins.catalog_segment_actions || [];
  const catValues  = ins.catalog_segment_value   || [];

  const getSegAction = type => {
    const a = catActions.find(x => x.action_type === type);
    return a ? parseFloat(a.value) || 0 : 0;
  };
  const getSegValue = type => {
    const a = catValues.find(x => x.action_type === type);
    return a ? parseFloat(a.value) || 0 : 0;
  };

  const cpas_purchase       = getSegAction('omni_purchase');
  const cpas_purchase_value = getSegValue('omni_purchase');
  const cpas_atc            = getSegAction('add_to_cart');
  const cpas_atc_value      = getSegValue('add_to_cart');
  // ROAS dari field khusus jika ada, fallback hitung manual
  const roas_raw   = ins.catalog_segment_value_omni_purchase_roas;
  const cpas_roas  = roas_raw
    ? parseFloat(roas_raw)
    : (spend > 0 && cpas_purchase_value > 0 ? cpas_purchase_value / spend : 0);

  const qRank  = ins.quality_ranking           || '—';
  const erRank = ins.engagement_rate_ranking   || '—';
  const crRank = ins.conversion_rate_ranking   || '—';

  return {
    id: c.id, name: c.name, status: c.status,
    objective: c.objective || '—',
    spend, impressions, reach, frequency, cpm,
    clicks, ctr, cpc, lpv, costPerLPV,
    totalActions, costPerResult,
    qRank, erRank, crRank,
    cpas_purchase, cpas_purchase_value,
    cpas_atc, cpas_atc_value,
    cpas_roas,
    _raw: { spend, impressions, clicks, ctr, cpc, reach, frequency, cpm, lpv, costPerResult,
            cpas_purchase, cpas_purchase_value, cpas_atc, cpas_atc_value, cpas_roas },
  };
}

export function applyFiltersAndSort() {
  const search = dom.searchCampaign.value.toLowerCase();
  const sf     = dom.filterStatus.value;

  let list = state.campaigns.map(buildRow);
  if (search) list = list.filter(c => c.name.toLowerCase().includes(search));
  if (sf)     list = list.filter(c => c.status === sf);

  list.sort((a, b) => {
    let va = a._raw[state.sortKey] ?? a[state.sortKey];
    let vb = b._raw[state.sortKey] ?? b[state.sortKey];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return state.sortDir === 'asc' ? -1 : 1;
    if (va > vb) return state.sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  state.filteredCampaigns = list;
  state.currentPage = 1;
  renderTablePage();
}

function rankBadge(val) {
  if (!val || val === '—') return '<span class="rank-badge unknown">—</span>';
  const cls = val.includes('ABOVE') ? 'above' : val.includes('BELOW') ? 'below' : 'avg';
  return `<span class="rank-badge ${cls}">${val.replace(/_/g,' ')}</span>`;
}

function renderTablePage() {
  const list    = state.filteredCampaigns;
  const cur     = state.accountCurrency;
  const columns = getActiveColumns();
  dom.tableCard.style.display = 'flex';

  // Dynamic header with sort indicators
  document.querySelector('#campaignTable thead tr').innerHTML =
    columns.map(k => {
      const cfg = COLUMN_CONFIG[k];
      if (!cfg.isNum && k !== 'name') return `<th>${cfg.label}</th>`;
      const isSorted = state.sortKey === k;
      const arrow = isSorted ? (state.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
      const sortable = cfg.isNum || k === 'name';
      return sortable
        ? `<th class="sortable${isSorted ? ' sorted' : ''}" data-col="${k}">${cfg.label}<span class="sort-arrow">${arrow || ' ↕'}</span></th>`
        : `<th>${cfg.label}</th>`;
    }).join('');

  // Attach sort click listeners on headers
  document.querySelectorAll('#campaignTable thead th.sortable').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const key = th.dataset.col;
      state.sortDir = state.sortKey === key ? (state.sortDir === 'asc' ? 'desc' : 'asc') : 'desc';
      state.sortKey = key;
      applyFiltersAndSort();
    });
  });

  // Dynamic body
  dom.campaignTableBody.innerHTML = list.map(c => `
    <tr>
      ${columns.map(k => {
        if (k === 'name')   return `<td class="col-sticky"><div class="campaign-name">${escHtml(c.name)}</div></td>`;
        if (k === 'status') return `<td><span class="status-badge ${c.status}">${c.status}</span></td>`;
        if (k === 'detail') return `<td><button class="btn-detail" data-id="${c.id}" data-name="${escHtml(c.name)}">▶ Detail</button></td>`;

        const val = c._raw[k] ?? c[k] ?? 0;

        if (k === 'cpas_roas') return `<td class="num">${val > 0 ? val.toFixed(2) + 'x' : '—'}</td>`;
        const isCurrency = ['spend','cpm','cpc','cpas_purchase_value','cpas_atc_value'].includes(k);
        if (isCurrency)  return `<td class="num">${val > 0 ? fmtCurrency(val, cur) : '—'}</td>`;
        if (k === 'ctr')  return `<td class="num">${fmtPct(val)}</td>`;
        const isCount = ['cpas_purchase','cpas_atc'].includes(k);
        if (isCount)  return `<td class="num">${val > 0 ? fmtNumber(val) : '—'}</td>`;
        return `<td class="num">${fmtNumber(val)}</td>`;
      }).join('')}
    </tr>`).join('') || `<tr><td colspan="${columns.length}">
      <div class="empty-state"><div class="empty-icon">📭</div><p>Tidak ada kampanye</p></div>
    </td></tr>`;

  dom.tableInfo.textContent = `${list.length} kampanye`;
  dom.pagination.innerHTML = '';
}

// ── DRAWER ────────────────────────────────────────────
function openDrawer(campaignId, campaignName) {
  state.drawerCampaignId = campaignId;
  dom.drawerTitle.textContent    = campaignName;
  dom.drawerSubtitle.textContent = 'ID: ' + campaignId;
  dom.adsetDrawer.classList.add('open');
  dom.drawerOverlay.classList.add('open');
  document.querySelectorAll('.drawer-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === 'adsets'));
  loadDrawerTab('adsets');
}

function closeDrawer() {
  dom.adsetDrawer.classList.remove('open');
  dom.drawerOverlay.classList.remove('open');
}

async function loadDrawerTab(tab) {
  state.drawerTab = tab;
  dom.drawerBody.innerHTML = `<div style="text-align:center;padding:48px">
    <div class="spinner" style="margin:0 auto 14px"></div><p style="color:#64748b">Memuat...</p></div>`;

  const dp  = getDatePreset(state.dateRange);
  const cur = state.accountCurrency;

  try {
    if (tab === 'adsets') {
      const adsets = await fetchAdSets(state.drawerCampaignId, dp);
      if (!adsets.length) { dom.drawerBody.innerHTML = emptyState('Tidak ada ad set'); return; }
      dom.drawerBody.innerHTML = `
        <table class="drawer-table">
          <thead><tr><th>Ad Set</th><th>Status</th><th>Spend</th><th>Reach</th><th>Impresi</th><th>Klik</th><th>CTR</th><th>CPC</th></tr></thead>
          <tbody>${adsets.map(a => `<tr>
            <td class="dn" title="${escHtml(a.name)}">${escHtml(a.name)}</td>
            <td><span class="status-badge ${a.status}">${a.status}</span></td>
            <td>${fmtCurrency(a.ins.spend||0,cur)}</td>
            <td>${fmtNumber(a.ins.reach||0)}</td>
            <td>${fmtNumber(a.ins.impressions||0)}</td>
            <td>${fmtNumber(a.ins.inline_link_clicks||0)}</td>
            <td>${fmtPct(a.ins.ctr||0)}</td>
            <td>${fmtCurrency(a.ins.cpc||0,cur)}</td>
          </tr>`).join('')}</tbody>
        </table>`;
    } else {
      const ads = await fetchAds(state.drawerCampaignId, dp);
      if (!ads.length) { dom.drawerBody.innerHTML = emptyState('Tidak ada ad'); return; }
      dom.drawerBody.innerHTML = `
        <table class="drawer-table">
          <thead><tr><th>Ad</th><th>Status</th><th>Spend</th><th>Impresi</th><th>Klik</th><th>CTR</th></tr></thead>
          <tbody>${ads.map(a => `<tr>
            <td class="dn" title="${escHtml(a.name)}">${escHtml(a.name)}</td>
            <td><span class="status-badge ${a.status}">${a.status}</span></td>
            <td>${fmtCurrency(a.ins.spend||0,cur)}</td>
            <td>${fmtNumber(a.ins.impressions||0)}</td>
            <td>${fmtNumber(a.ins.inline_link_clicks||0)}</td>
            <td>${fmtPct(a.ins.ctr||0)}</td>
          </tr>`).join('')}</tbody>
        </table>`;
    }
  } catch (err) {
    dom.drawerBody.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div>
      <p style="color:#ef4444">${escHtml(err.message)}</p></div>`;
  }
}

function emptyState(msg) {
  return `<div class="empty-state"><div class="empty-icon">📭</div><p>${msg}</p></div>`;
}

// ── EXPORT CSV ────────────────────────────────────────
function exportCSV() {
  const cur    = state.accountCurrency;
  const isCpas = state.activeAdGroup === 'CPAS Ads';

  const headers = ['Kampanye','Status','Spend','Impresi','Jangkauan','Frekuensi','CPM','Klik','CTR','CPC',
    ...(isCpas ? ['Pembelian Item Bersama','Nilai Konversi Pembelian','Tambah Keranjang Item Bersama','Nilai Konversi Keranjang','ROAS Item Bersama'] : []),
  ];

  const rows = state.filteredCampaigns.map(c => [
    `"${c.name.replace(/"/g,'""')}"`, c.status,
    c.spend.toFixed(2), c.impressions, c.reach, c.frequency.toFixed(2),
    c.cpm.toFixed(2), c.clicks, c.ctr.toFixed(2)+'%', c.cpc.toFixed(2),
    ...(isCpas ? [
      c.cpas_purchase, c.cpas_purchase_value.toFixed(2),
      c.cpas_atc, c.cpas_atc_value.toFixed(2),
      c.cpas_roas.toFixed(2),
    ] : []),
  ]);

  const csv  = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `meta-${isCpas ? 'cpas' : 'regular'}-${state.dateRange}-${Date.now()}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ── DASHBOARD LOAD ────────────────────────────────────
export async function loadDashboard() {
  showLoading('Mengambil data kampanye...');
  const dp = getDatePreset(state.dateRange);

  try {
    const isCpas = state.activeAdGroup === 'CPAS Ads';
    const [accInfo, campaigns, campaignInsights] = await Promise.all([
      fetchAccount(state.accountId),
      fetchCampaigns(state.accountId),
      fetchCampaignInsights(state.accountId, dp, isCpas),
    ]);

    state.accountName     = accInfo.name || 'Ad Account';
    state.accountCurrency = accInfo.currency || 'IDR';
    dom.accountName.textContent      = state.accountName;
    dom.accountIdDisplay.textContent = `act_${state.accountId} · ${state.accountCurrency}`;
    dom.accountBar.style.display = 'flex';

    state.campaigns    = campaigns;
    state.insightMap   = {};
    state.campaignMeta = {};
    campaignInsights.forEach(ci => { state.insightMap[ci.campaign_id] = ci; });
    campaigns.forEach(c => { state.campaignMeta[c.id] = c; });
    state._campaignInsights = campaignInsights;

    applyFiltersAndSort();
    dom.lastUpdated.textContent = 'Diperbarui: ' + new Date().toLocaleTimeString('id-ID');
    hideLoading();
  } catch (err) {
    hideLoading();
    showError('Gagal memuat data: ' + err.message);
    console.error(err);
  }
}

// ── EVENTS ────────────────────────────────────────────
export function initEvents() {
  dom.sidebarToggle.addEventListener('click', () => dom.sidebar.classList.toggle('collapsed'));
  dom.dateRange.addEventListener('change', () => { state.dateRange = dom.dateRange.value; loadDashboard(); });
  dom.btnRefresh.addEventListener('click', async () => {
    dom.btnRefresh.classList.add('spinning');
    await loadDashboard();
    dom.btnRefresh.classList.remove('spinning');
  });

  dom.adGroupTabs.addEventListener('click', async e => {
    const btn = e.target.closest('.adgroup-tab');
    if (!btn) return;
    const group = btn.dataset.group;
    if (group === state.activeAdGroup) return;
    document.querySelectorAll('.adgroup-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    state.activeAdGroup = group;
    state.accountId     = AD_GROUPS[group];
    await loadDashboard();
  });

  dom.searchCampaign.addEventListener('input', applyFiltersAndSort);
  dom.filterStatus.addEventListener('change', applyFiltersAndSort);
  dom.btnExportCSV.addEventListener('click', exportCSV);

  dom.campaignTableBody.addEventListener('click', e => {
    const btn = e.target.closest('.btn-detail');
    if (btn) openDrawer(btn.dataset.id, btn.dataset.name);
  });

  document.querySelectorAll('.drawer-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.drawer-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadDrawerTab(tab.dataset.tab);
    });
  });

  dom.btnCloseDrawer.addEventListener('click', closeDrawer);
  dom.drawerOverlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
  dom.btnDismissError.addEventListener('click', () => dom.errorBanner.style.display = 'none');
}
