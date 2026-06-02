/**
 * Entry point — boots the app
 */
import './style.css';
import { TokenManager, loadDashboard, initEvents } from './app.js';
import { initAiAgent } from './ai-agent.js';
import { FALLBACK_TOKEN } from './lib/config.js';
import { setToken } from './lib/api.js';

document.addEventListener('DOMContentLoaded', async () => {
  initEvents();
  initAiAgent();

  // Set token immediately so first API call works while inspect runs in bg
  const stored = localStorage.getItem('mam_meta_token');
  const token  = stored || FALLBACK_TOKEN;
  setToken(token);

  // Inspect + auto-extend in background (non-blocking)
  TokenManager.init(FALLBACK_TOKEN).catch(console.warn);

  // Load dashboard
  await loadDashboard();
});
