/**
 * Dashboard controller — orchestrates data fetching and wires up events.
 * Delegates rendering to renderer.js and data access to api.js.
 */
import { state } from './state.js';
import {
  showError, showLoading, hideLoading,
  renderAccountBar, applyFiltersAndSort,
  openDrawer, closeDrawer,
} from './renderer.js';
import {
  fetchAccount, fetchCampaigns, fetchCampaignInsights,
} from '../../lib/api.js';
import { fmtCurrency } from '../../lib/helpers.js';
import { getDatePreset, escHtml } from '../../lib/helpers.js';
import { AD_GROUPS } from '../../lib/config.js';

const $ = id => document.getElementById(id);

// ── DOM refs (event targets only) ─────────────────────
const dom = {
  sidebar:        $('sidebar'),
  sidebarToggle:  $('sidebarToggle'),
  dateRange:      $('dateRange'),
  btnRefresh:     $('btnRefresh'),
  adGroupTabs:    $('adGroupTabs'),
  searchCampaign: $('searchCampaign'),
  filterStatus:   $('filterStatus'),
  btnExportCSV:   $('btnExportCSV'),
  campaignTableBody: $('campaignTableBody'),
  btnCloseDrawer: $('btnCloseDrawer'),
  drawerOverlay:  $('drawerOverlay'),
  errorBanner:    $('errorBanner'),
  btnDismissError:$('btnDismissError'),
};

// ── Load dashboard ────────────────────────────────────

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

    renderAccountBar(accInfo);

    state.campaigns    = campaigns;
    state.insightMap   = {};
    state.campaignMeta = {};
    campaignInsights.forEach(ci => { state.insightMap[ci.campaign_id] = ci; });
    campaigns.forEach(c => { state.campaignMeta[c.id] = c; });
    state._campaignInsights = campaignInsights;

    applyFiltersAndSort();
    hideLoading();
  } catch (err) {
    hideLoading();
    showError('Gagal memuat data: ' + err.message);
    console.error(err);
  }
}

// ── CSV export ────────────────────────────────────────

function exportCSV() {
  const cur    = state.accountCurrency;
  const isCpas = state.activeAdGroup === 'CPAS Ads';

  const headers = [
    'Kampanye','Status','Spend','Impresi','Jangkauan','Frekuensi','CPM','Klik','CTR','CPC',
    ...(isCpas ? [
      'Pembelian Item Bersama','Nilai Konversi Pembelian',
      'Tambah Keranjang Item Bersama','Nilai Konversi Keranjang','ROAS Item Bersama',
    ] : []),
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
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `meta-${isCpas ? 'cpas' : 'regular'}-${state.dateRange}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Event wiring ──────────────────────────────────────

export function initEvents() {
  dom.sidebarToggle.addEventListener('click', () =>
    dom.sidebar.classList.toggle('collapsed'));

  dom.dateRange.addEventListener('change', () => {
    state.dateRange = dom.dateRange.value;
    loadDashboard();
  });

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

  dom.btnCloseDrawer.addEventListener('click', closeDrawer);
  dom.drawerOverlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
  dom.btnDismissError.addEventListener('click', () => {
    document.getElementById('errorBanner').style.display = 'none';
  });
}
