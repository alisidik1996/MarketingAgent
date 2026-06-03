/**
 * Dashboard renderer — all DOM mutation happens here.
 * No fetch calls. Reads from `state` and writes to DOM.
 */
import { state } from './state.js';
import {
  COLUMN_CONFIG,
  ACTIVE_COLUMNS_REGULAR,
  ACTIVE_COLUMNS_CPAS,
} from '../../lib/config.js';
import { fmtCurrency, fmtNumber, fmtPct, escHtml, getAction } from '../../lib/helpers.js';
import { fetchAdSets, fetchAds } from '../../lib/api.js';
import { getDatePreset } from '../../lib/helpers.js';

// ── DOM refs ──────────────────────────────────────────
const $ = id => document.getElementById(id);
const dom = {
  accountBar:        $('accountBar'),
  accountName:       $('accountName'),
  accountIdDisplay:  $('accountIdDisplay'),
  accountSpendInfo:  $('accountSpendInfo'),
  tableCard:         $('tableCard'),
  searchCampaign:    $('searchCampaign'),
  filterStatus:      $('filterStatus'),
  campaignTableBody: $('campaignTableBody'),
  tableInfo:         $('tableInfo'),
  pagination:        $('pagination'),
  adsetDrawer:       $('adsetDrawer'),
  drawerOverlay:     $('drawerOverlay'),
  drawerTitle:       $('drawerTitle'),
  drawerSubtitle:    $('drawerSubtitle'),
  drawerBreadcrumb:  $('drawerBreadcrumb'),
  drawerBody:        $('drawerBody'),
  loadingOverlay:    $('loadingOverlay'),
  loadingText:       $('loadingText'),
  errorBanner:       $('errorBanner'),
  errorMessage:      $('errorMessage'),
  lastUpdated:       $('lastUpdated'),
};

// ── Loading / Error ───────────────────────────────────

export function showError(msg) {
  dom.errorMessage.textContent = msg;
  dom.errorBanner.style.display = 'flex';
  setTimeout(() => { dom.errorBanner.style.display = 'none'; }, 10000);
}

export function showLoading(text = 'Mengambil data...') {
  dom.loadingText.textContent = text;
  dom.loadingOverlay.style.display = 'flex';
}

export function hideLoading() {
  dom.loadingOverlay.style.display = 'none';
}

// ── Account bar ───────────────────────────────────────

export function renderAccountBar(accInfo) {
  const { name, currency, amount_spent, balance, spend_cap } = accInfo;
  const cur = currency || 'IDR';
  state.accountName     = name || 'Ad Account';
  state.accountCurrency = cur;

  dom.accountName.textContent      = state.accountName;
  dom.accountIdDisplay.textContent = `act_${state.accountId} · ${cur}`;

  if (dom.accountSpendInfo) {
    const amountSpent = parseFloat(amount_spent || 0);
    const bal         = parseFloat(balance      || 0);
    const cap         = parseFloat(spend_cap    || 0);
    dom.accountSpendInfo.innerHTML = `
      <div class="spend-stat">
        <span class="spend-label">Saldo</span>
        <span class="spend-val">${fmtCurrency(bal, cur)}</span>
      </div>
      ${cap > 0 ? `<div class="spend-stat">
        <span class="spend-label">Batas Spend</span>
        <span class="spend-val">${fmtCurrency(cap, cur)}</span>
      </div>` : ''}`;
  }
  dom.accountBar.style.display = 'flex';
}

// ── Table helpers ─────────────────────────────────────

function getActiveColumns() {
  return state.activeAdGroup === 'CPAS Ads' ? ACTIVE_COLUMNS_CPAS : ACTIVE_COLUMNS_REGULAR;
}

function buildRow(c) {
  const ins  = state.insightMap[c.id] || {};
  const spend       = parseFloat(ins.spend)       || 0;
  const impressions = parseFloat(ins.impressions) || 0;
  const reach       = parseFloat(ins.reach)       || 0;
  const frequency   = parseFloat(ins.frequency)   || 0;
  const cpm         = parseFloat(ins.cpm)         || 0;
  const clicks      = parseFloat(ins.clicks)      || 0;
  const ctr         = parseFloat(ins.ctr)         || 0;
  const cpc         = parseFloat(ins.cpc)         || 0;
  const lpv         = getAction(ins.actions, 'landing_page_view');

  const purchases    = getAction(ins.actions, 'purchase') || getAction(ins.actions, 'offsite_conversion.fb_pixel_purchase');
  const leads        = getAction(ins.actions, 'lead')     || getAction(ins.actions, 'offsite_conversion.fb_pixel_lead');
  const atc          = getAction(ins.actions, 'add_to_cart') || getAction(ins.actions, 'offsite_conversion.fb_pixel_add_to_cart');
  const totalActions = purchases + leads + atc;
  const costPerResult = totalActions > 0 ? spend / totalActions : 0;
  const costPerLPV    = lpv > 0 ? spend / lpv : 0;

  const catActions = ins.catalog_segment_actions || [];
  const catValues  = ins.catalog_segment_value   || [];
  const getSegAction = type => { const a = catActions.find(x => x.action_type === type); return a ? parseFloat(a.value) || 0 : 0; };
  const getSegValue  = type => { const a = catValues.find(x => x.action_type === type);  return a ? parseFloat(a.value) || 0 : 0; };

  const cpas_purchase       = getSegAction('omni_purchase');
  const cpas_purchase_value = getSegValue('omni_purchase');
  const cpas_atc            = getSegAction('add_to_cart');
  const cpas_atc_value      = getSegValue('add_to_cart');
  const roasArr             = ins.catalog_segment_value_omni_purchase_roas;
  const cpas_roas           = Array.isArray(roasArr) && roasArr.length
    ? parseFloat(roasArr[0].value) || 0
    : (spend > 0 && cpas_purchase_value > 0 ? cpas_purchase_value / spend : 0);
  const cpas_cost_per_conv  = cpas_purchase > 0 ? spend / cpas_purchase : 0;

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
    cpas_roas, cpas_cost_per_conv,
    _raw: {
      spend, impressions, clicks, ctr, cpc, reach, frequency, cpm, lpv, costPerResult,
      cpas_purchase, cpas_purchase_value, cpas_atc, cpas_atc_value, cpas_roas, cpas_cost_per_conv,
    },
  };
}

function rankBadge(val) {
  if (!val || val === '—') return '<span class="rank-badge unknown">—</span>';
  const cls = val.includes('ABOVE') ? 'above' : val.includes('BELOW') ? 'below' : 'avg';
  return `<span class="rank-badge ${cls}">${val.replace(/_/g, ' ')}</span>`;
}

// ── Table render ──────────────────────────────────────

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

export function renderTablePage() {
  const list    = state.filteredCampaigns;
  const cur     = state.accountCurrency;
  const columns = getActiveColumns();
  dom.tableCard.style.display = 'flex';

  // Dynamic headers
  document.querySelector('#campaignTable thead tr').innerHTML =
    columns.map(k => {
      const cfg      = COLUMN_CONFIG[k];
      const isSorted = state.sortKey === k;
      const arrow    = isSorted ? (state.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
      const sortable = cfg.isNum || k === 'name';
      return sortable
        ? `<th class="sortable${isSorted ? ' sorted' : ''}" data-col="${k}">${cfg.label}<span class="sort-arrow">${arrow || ' ↕'}</span></th>`
        : `<th>${cfg.label}</th>`;
    }).join('');

  // Sort listeners
  document.querySelectorAll('#campaignTable thead th.sortable').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const key = th.dataset.col;
      state.sortDir = state.sortKey === key ? (state.sortDir === 'asc' ? 'desc' : 'asc') : 'desc';
      state.sortKey = key;
      applyFiltersAndSort();
    });
  });

  // Rows
  dom.campaignTableBody.innerHTML = list.map(c => `
    <tr>
      ${columns.map(k => {
        if (k === 'name')   return `<td class="col-sticky"><div class="campaign-name">${escHtml(c.name)}</div></td>`;
        if (k === 'status') return `<td><span class="status-badge ${c.status}">${c.status}</span></td>`;
        if (k === 'detail') return `<td><button class="btn-detail" data-id="${c.id}" data-name="${escHtml(c.name)}">▶ Detail</button></td>`;
        const val = c._raw[k] ?? c[k] ?? 0;
        if (k === 'cpas_roas') return `<td class="num">${val > 0 ? val.toFixed(2) + 'x' : '—'}</td>`;
        const isCurrency = ['spend','cpm','cpc','cpas_purchase_value','cpas_atc_value','cpas_cost_per_conv'].includes(k);
        if (isCurrency)  return `<td class="num">${val > 0 ? fmtCurrency(val, cur) : '—'}</td>`;
        if (k === 'ctr')  return `<td class="num">${fmtPct(val)}</td>`;
        const isCount = ['cpas_purchase','cpas_atc'].includes(k);
        if (isCount) return `<td class="num">${val > 0 ? fmtNumber(val) : '—'}</td>`;
        return `<td class="num">${fmtNumber(val)}</td>`;
      }).join('')}
    </tr>`).join('') || `<tr><td colspan="${columns.length}">
      <div class="empty-state"><div class="empty-icon">📭</div><p>Tidak ada kampanye</p></div>
    </td></tr>`;

  // Totals footer
  const totals = list.reduce((acc, c) => {
    columns.forEach(k => {
      if (!['name','status','detail','ctr','cpm','cpc','cpas_roas','cpas_cost_per_conv'].includes(k)) {
        acc[k] = (acc[k] || 0) + (c._raw[k] ?? c[k] ?? 0);
      }
    });
    return acc;
  }, {});

  const totalSpend  = totals.spend        || 0;
  const totalImpres = totals.impressions   || 0;
  const totalClicks = totals.clicks        || 0;
  const avgCTR      = totalImpres > 0 ? totalClicks / totalImpres * 100 : 0;
  const avgCPM      = totalImpres > 0 ? totalSpend / totalImpres * 1000 : 0;
  const avgCPC      = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const cpasVal     = totals.cpas_purchase_value || 0;
  const avgROAS     = totalSpend > 0 && cpasVal > 0 ? cpasVal / totalSpend : 0;

  const tfoot = document.querySelector('#campaignTable tfoot tr');
  if (tfoot) {
    tfoot.innerHTML = columns.map(k => {
      if (k === 'name')    return `<td class="col-sticky foot-label">Total (${list.length})</td>`;
      if (['status','detail'].includes(k)) return `<td></td>`;
      if (k === 'ctr')     return `<td class="num foot-val">${fmtPct(avgCTR)}</td>`;
      if (k === 'cpm')     return `<td class="num foot-val">${fmtCurrency(avgCPM, cur)}</td>`;
      if (k === 'cpc')     return `<td class="num foot-val">${fmtCurrency(avgCPC, cur)}</td>`;
      if (k === 'cpas_roas') return `<td class="num foot-val">${avgROAS > 0 ? avgROAS.toFixed(2) + 'x' : '—'}</td>`;
      if (k === 'cpas_cost_per_conv') {
        const v = (totals.cpas_purchase || 0) > 0 ? (totals.spend || 0) / totals.cpas_purchase : 0;
        return `<td class="num foot-val">${v > 0 ? fmtCurrency(v, cur) : '—'}</td>`;
      }
      const val = totals[k] || 0;
      const isCurrency = ['spend','cpas_purchase_value','cpas_atc_value'].includes(k);
      return isCurrency
        ? `<td class="num foot-val">${val > 0 ? fmtCurrency(val, cur) : '—'}</td>`
        : `<td class="num foot-val">${val > 0 ? fmtNumber(val) : '—'}</td>`;
    }).join('');
  }

  dom.tableInfo.textContent = `${list.length} kampanye`;
  dom.pagination.innerHTML  = '';
  dom.lastUpdated.textContent = 'Diperbarui: ' + new Date().toLocaleTimeString('id-ID');
}

// ── Drawer ────────────────────────────────────────────
const drawerNav = [];

export function openDrawer(campaignId, campaignName) {
  state.drawerCampaignId = campaignId;
  drawerNav.length = 0;
  dom.adsetDrawer.classList.add('open');
  dom.drawerOverlay.classList.add('open');
  loadAdSetsInDrawer(campaignId, campaignName);
}

export function closeDrawer() {
  dom.adsetDrawer.classList.remove('open');
  dom.drawerOverlay.classList.remove('open');
  drawerNav.length = 0;
}

function renderBreadcrumb() {
  const bc = dom.drawerBreadcrumb;
  if (!bc) return;
  bc.innerHTML = drawerNav.map((n, i) =>
    i < drawerNav.length - 1
      ? `<span class="bc-link" data-idx="${i}">${escHtml(n.label)}</span><span class="bc-sep">›</span>`
      : `<span class="bc-cur">${escHtml(n.label)}</span>`
  ).join('');
  bc.querySelectorAll('.bc-link').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx);
      drawerNav.splice(idx + 1);
      drawerNav[idx].action();
    });
  });
}

async function loadAdSetsInDrawer(campaignId, campaignName) {
  drawerNav.push({ label: campaignName, action: () => loadAdSetsInDrawer(campaignId, campaignName) });
  dom.drawerTitle.textContent    = campaignName;
  dom.drawerSubtitle.textContent = 'Ad Sets';
  renderBreadcrumb();
  dom.drawerBody.innerHTML = loadingHtml();

  const dp     = getDatePreset(state.dateRange);
  const cur    = state.accountCurrency;
  const isCpas = state.activeAdGroup === 'CPAS Ads';

  try {
    const adsets = await fetchAdSets(campaignId, dp, isCpas);
    if (!adsets.length) { dom.drawerBody.innerHTML = emptyState('Tidak ada ad set'); return; }

    const cpasHeaders = isCpas ? `
      <th>Pembelian Item Bersama</th><th>Nilai Konversi</th>
      <th>Tambah Keranjang</th><th>Nilai Keranjang</th><th>ROAS</th>` : '';

    dom.drawerBody.innerHTML = `
      <table class="drawer-table">
        <thead><tr>
          <th>Ad Set</th><th>Penayangan</th><th>Jangkauan</th>
          <th>Jumlah Dibelanjakan</th><th>Impresi</th><th>CPM</th>
          <th>Klik (Semua)</th><th>CTR</th><th>CPC</th>
          ${cpasHeaders}<th></th>
        </tr></thead>
        <tbody>${adsets.map(a => {
          const campIns    = state.insightMap[campaignId] || {};
          const insForCpas = a.ins.catalog_segment_actions?.length ? a.ins : campIns;
          return `<tr>
            <td class="dn" title="${escHtml(a.name)}">${escHtml(a.name)}</td>
            <td><span class="status-badge ${a.status}">${a.status}</span></td>
            <td class="num">${fmtNumber(a.ins.reach||0)}</td>
            <td class="num">${fmtCurrency(a.ins.spend||0, cur)}</td>
            <td class="num">${fmtNumber(a.ins.impressions||0)}</td>
            <td class="num">${fmtCurrency(a.ins.cpm||0, cur)}</td>
            <td class="num">${fmtNumber(a.ins.clicks||0)}</td>
            <td class="num">${fmtPct(a.ins.ctr||0)}</td>
            <td class="num">${fmtCurrency(a.ins.cpc||0, cur)}</td>
            ${isCpas ? cpasRowHtml(insForCpas, cur) : ''}
            <td><button class="btn-detail btn-drill" data-id="${a.id}" data-name="${escHtml(a.name)}">▶ Ads</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;

    dom.drawerBody.querySelectorAll('.btn-drill').forEach(btn => {
      btn.addEventListener('click', () => loadAdsInDrawer(campaignId, btn.dataset.id, btn.dataset.name));
    });
  } catch (err) {
    dom.drawerBody.innerHTML = errHtml(err.message);
  }
}

async function loadAdsInDrawer(campaignId, adsetId, adsetName) {
  drawerNav.push({ label: adsetName, action: () => loadAdsInDrawer(campaignId, adsetId, adsetName) });
  dom.drawerTitle.textContent    = adsetName;
  dom.drawerSubtitle.textContent = 'Ads';
  renderBreadcrumb();
  dom.drawerBody.innerHTML = loadingHtml();

  const dp     = getDatePreset(state.dateRange);
  const cur    = state.accountCurrency;
  const isCpas = state.activeAdGroup === 'CPAS Ads';

  try {
    const ads = await fetchAds(campaignId, dp, isCpas, adsetId);
    if (!ads.length) { dom.drawerBody.innerHTML = emptyState('Tidak ada ad'); return; }

    const cpasHeaders = isCpas ? `
      <th>Pembelian Item Bersama</th><th>Nilai Konversi</th>
      <th>Tambah Keranjang</th><th>Nilai Keranjang</th><th>ROAS</th>` : '';

    dom.drawerBody.innerHTML = `
      <table class="drawer-table">
        <thead><tr>
          <th>Ad</th><th>Penayangan</th><th>Jangkauan</th>
          <th>Jumlah Dibelanjakan</th><th>Impresi</th><th>CPM</th>
          <th>Klik (Semua)</th><th>CTR</th><th>CPC</th>
          ${cpasHeaders}
        </tr></thead>
        <tbody>${ads.map(a => {
          const campIns    = state.insightMap[campaignId] || {};
          const insForCpas = a.ins.catalog_segment_actions?.length ? a.ins : campIns;
          return `<tr>
            <td class="dn" title="${escHtml(a.name)}">${escHtml(a.name)}</td>
            <td><span class="status-badge ${a.status}">${a.status}</span></td>
            <td class="num">${fmtNumber(a.ins.reach||0)}</td>
            <td class="num">${fmtCurrency(a.ins.spend||0, cur)}</td>
            <td class="num">${fmtNumber(a.ins.impressions||0)}</td>
            <td class="num">${fmtCurrency(a.ins.cpm||0, cur)}</td>
            <td class="num">${fmtNumber(a.ins.clicks||0)}</td>
            <td class="num">${fmtPct(a.ins.ctr||0)}</td>
            <td class="num">${fmtCurrency(a.ins.cpc||0, cur)}</td>
            ${isCpas ? cpasRowHtml(insForCpas, cur) : ''}
          </tr>`;
        }).join('')}</tbody>
      </table>`;
  } catch (err) {
    dom.drawerBody.innerHTML = errHtml(err.message);
  }
}

function cpasRowHtml(ins, cur) {
  const catA = ins.catalog_segment_actions || [];
  const catV = ins.catalog_segment_value   || [];
  const getA = type => { const a = catA.find(x => x.action_type === type); return a ? parseFloat(a.value)||0 : 0; };
  const getV = type => { const a = catV.find(x => x.action_type === type); return a ? parseFloat(a.value)||0 : 0; };
  const roasArr = ins.catalog_segment_value_omni_purchase_roas;
  const roas = Array.isArray(roasArr) && roasArr.length
    ? parseFloat(roasArr[0].value) || 0
    : (() => { const v = getV('omni_purchase'), s = parseFloat(ins.spend)||0; return s>0&&v>0?v/s:0; })();
  return `
    <td class="num">${getA('omni_purchase') || '—'}</td>
    <td class="num">${getV('omni_purchase') > 0 ? fmtCurrency(getV('omni_purchase'), cur) : '—'}</td>
    <td class="num">${getA('add_to_cart') || '—'}</td>
    <td class="num">${getV('add_to_cart') > 0 ? fmtCurrency(getV('add_to_cart'), cur) : '—'}</td>
    <td class="num">${roas > 0 ? roas.toFixed(2) + 'x' : '—'}</td>`;
}

function loadingHtml() {
  return `<div style="text-align:center;padding:48px">
    <div class="spinner" style="margin:0 auto 14px"></div>
    <p style="color:#64748b">Memuat...</p></div>`;
}

function errHtml(msg) {
  return `<div class="empty-state"><div class="empty-icon">⚠️</div>
    <p style="color:#ef4444">${escHtml(msg)}</p></div>`;
}

function emptyState(msg) {
  return `<div class="empty-state"><div class="empty-icon">📭</div><p>${msg}</p></div>`;
}
