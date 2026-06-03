/**
 * Pure utility functions — no side effects, no DOM.
 */

export function fmtCurrency(val, currency = 'IDR') {
  const n = parseFloat(val) || 0;
  if (currency === 'IDR')
    return 'Rp\u00a0' + n.toLocaleString('id-ID', { maximumFractionDigits: 0 });
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, maximumFractionDigits: 2,
  }).format(n);
}

export function fmtNumber(val) {
  const n = parseFloat(val) || 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString('id-ID');
}

export function fmtPct(val) {
  return (parseFloat(val) || 0).toFixed(2) + '%';
}

export function getDatePreset(range) {
  const today = new Date();
  const fmt   = d => d.toISOString().split('T')[0];
  const sub   = (d, n) => { const x = new Date(d); x.setDate(x.getDate() - n); return x; };
  switch (range) {
    case 'today':      return { since: fmt(today), until: fmt(today) };
    case 'yesterday':  return { since: fmt(sub(today,1)), until: fmt(sub(today,1)) };
    case 'last_7d':    return { since: fmt(sub(today,6)), until: fmt(today) };
    case 'last_30d':   return { since: fmt(sub(today,29)), until: fmt(today) };
    case 'this_month': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { since: fmt(s), until: fmt(today) };
    }
    case 'last_month': {
      const s = new Date(today.getFullYear(), today.getMonth()-1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      return { since: fmt(s), until: fmt(e) };
    }
    default: return { since: fmt(sub(today,6)), until: fmt(today) };
  }
}

export function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

export function getAction(actions, type) {
  if (!Array.isArray(actions)) return 0;
  const a = actions.find(x => x.action_type === type);
  return a ? parseFloat(a.value) || 0 : 0;
}
