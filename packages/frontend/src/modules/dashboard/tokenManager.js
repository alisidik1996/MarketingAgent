/**
 * TokenManager — inspect, extend, persist, and display Meta token status.
 */
import {
  LS_TOKEN, LS_EXPIRY, LS_TYPE,
  TOKEN_WARN_DAYS, TOKEN_REFRESH_DAYS,
} from '../../lib/config.js';
import { setToken, getToken, inspectToken, extendToken } from '../../lib/api.js';

const $ = id => document.getElementById(id);

export const TokenManager = {
  // ── Persistence ──────────────────────────────────────

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

  // ── Extend ───────────────────────────────────────────

  async doExtend(token) {
    const data      = await extendToken(token);
    const expiresIn = data.expires_in || 5183944;
    this.save(data.access_token, expiresIn, 'long');
    return data.access_token;
  },

  // ── Init (non-blocking) ───────────────────────────────

  async init(fallbackToken) {
    const stored = this.load();
    let token    = stored?.token || fallbackToken;

    try {
      this.updateUI({ status: 'checking' });
      const info = await inspectToken(token);

      if (!info.is_valid) {
        token = await this.doExtend(fallbackToken);
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

  // ── Manual extend ─────────────────────────────────────

  async manualExtend() {
    const btn = $('btnExtendToken');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Memperpanjang...'; }
    try {
      const stored  = this.load();
      const current = stored?.token || getToken();
      await this.doExtend(current);
      this.updateUI({ status: 'extended' });
      if (btn) btn.textContent = '✅ Berhasil';
      setTimeout(() => {
        if (btn) { btn.disabled = false; btn.textContent = '🔄 Perpanjang'; }
      }, 3000);
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Perpanjang'; }
      // Import showError lazily to avoid circular deps
      const { showError } = await import('./renderer.js');
      showError('Gagal perpanjang token: ' + err.message);
    }
  },

  // ── UI ────────────────────────────────────────────────

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
