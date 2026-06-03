/**
 * Entry point — boots the application.
 */
import './style.css';
import { TokenManager, loadDashboard, initEvents } from './app.js';
import { FALLBACK_TOKEN } from './lib/config.js';
import { setToken } from './lib/api.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Wire up all dashboard event listeners
  initEvents();

  // Set token immediately so the first API call works
  // while token inspect runs in the background
  const stored = localStorage.getItem('mam_meta_token');
  const token  = stored || FALLBACK_TOKEN;
  setToken(token);

  // Inspect + auto-extend in background (non-blocking)
  TokenManager.init(FALLBACK_TOKEN).catch(console.warn);

  // Load dashboard data
  await loadDashboard();
});
