/**
 * AI Agent — calls backend /api/ai/chat (no API key in browser)
 */
import { chatWithAI }              from './lib/api.js';
import { AI_MODELS, AI_DEFAULT_MODEL } from './lib/config.js';
import { renderMarkdown, escHtml } from './lib/helpers.js';
import { state }                   from './app.js';

// ── STATE ─────────────────────────────────────────────
const aiState = {
  model:       AI_DEFAULT_MODEL,
  temperature: 0.7,
  lang:        'id',
  history:     [],
  busy:        false,
  panelOpen:   false,
};

// ── DOM ───────────────────────────────────────────────
const ai$ = id => document.getElementById(id);
const aiDom = {
  fab:           ai$('aiFab'),
  fabBadge:      ai$('aiFabBadge'),
  panel:         ai$('aiPanel'),
  overlay:       ai$('aiOverlay'),
  messages:      ai$('aiMessages'),
  input:         ai$('aiInput'),
  sendBtn:       ai$('aiSendBtn'),
  sendIcon:      ai$('aiSendIcon'),
  clearBtn:      ai$('btnAiClear'),
  closeBtn:      ai$('btnAiClose'),
  settingsBtn:   ai$('btnAiSettings'),
  settingsPanel: ai$('aiSettingsPanel'),
  modelSelect:   ai$('aiModelSelect'),
  modelLabel:    ai$('aiModelLabel'),
  tempSlider:    ai$('aiTemp'),
  tempVal:       ai$('aiTempVal'),
  langSelect:    ai$('aiLang'),
  quickActions:  ai$('aiQuickActions'),
  contextInfo:   ai$('aiContextInfo'),
};

// ── CONTEXT ───────────────────────────────────────────
function buildContext() {
  if (!state.campaigns?.length) return null;
  const campaigns = state.filteredCampaigns || [];
  const totals = campaigns.reduce((acc, c) => {
    acc.spend       += c.spend || 0;
    acc.impressions += c.impressions || 0;
    acc.clicks      += c.clicks || 0;
    acc.reach       += c.reach || 0;
    return acc;
  }, { spend:0, impressions:0, clicks:0, reach:0 });

  return {
    periode:    state.dateRange,
    grup_iklan: state.activeAdGroup,
    mata_uang:  state.accountCurrency,
    ringkasan: {
      total_kampanye:  campaigns.length,
      aktif:           campaigns.filter(c => c.status === 'ACTIVE').length,
      dijeda:          campaigns.filter(c => c.status === 'PAUSED').length,
      total_spend:     Math.round(totals.spend),
      total_impresi:   Math.round(totals.impressions),
      total_klik:      Math.round(totals.clicks),
      total_jangkauan: Math.round(totals.reach),
      rata_ctr:        totals.impressions > 0
        ? (totals.clicks / totals.impressions * 100).toFixed(2) + '%' : '0%',
    },
    top5_by_spend: [...campaigns]
      .sort((a,b) => b.spend - a.spend).slice(0,5)
      .map(c => ({
        nama: c.name, status: c.status,
        spend: Math.round(c.spend),
        ctr: c.ctr?.toFixed(2) + '%',
        cpc: Math.round(c.cpc),
        jangkauan: Math.round(c.reach),
      })),
    semua_kampanye: campaigns.slice(0,30).map(c => ({
      nama: c.name, status: c.status,
      spend: Math.round(c.spend),
      impresi: Math.round(c.impressions),
      klik: Math.round(c.clicks),
      ctr: c.ctr?.toFixed(2) + '%',
      cpc: Math.round(c.cpc),
      jangkauan: Math.round(c.reach),
    })),
  };
}

function systemPrompt() {
  const ctx  = buildContext();
  const base = aiState.lang === 'id'
    ? `Kamu adalah AI Marketing Agent ahli Meta Ads. Tugasmu: analisis data kampanye, berikan insight actionable, dan rekomendasikan optimasi. Gunakan bahasa Indonesia profesional. Sertakan angka konkret. Sebutkan nama kampanye spesifik jika ada masalah.`
    : `You are a Meta Ads AI Marketing Agent. Analyze campaign data, provide actionable insights, recommend optimizations. Use professional language. Include concrete numbers. Name specific campaigns when issues arise.`;

  if (!ctx) return base + '\n\nData kampanye belum tersedia.';
  return base + `\n\n--- DATA KAMPANYE ---\n${JSON.stringify(ctx,null,2)}\n--- END ---\nSemua nilai spend dalam ${ctx.mata_uang}.`;
}

function updateContextInfo() {
  const ctx = buildContext();
  if (!ctx) {
    aiDom.contextInfo.textContent  = '📊 Data belum dimuat';
    aiDom.contextInfo.style.color  = 'var(--text-muted)';
  } else {
    aiDom.contextInfo.textContent  = `📊 ${ctx.ringkasan.total_kampanye} kampanye · ${ctx.grup_iklan} · ${ctx.periode}`;
    aiDom.contextInfo.style.color  = 'var(--green)';
  }
}

// ── SEND ──────────────────────────────────────────────
async function sendToAI(userMessage) {
  if (aiState.busy) return;
  aiState.busy = true;

  appendMessage('user', userMessage);
  aiState.history.push({ role: 'user', content: userMessage });
  if (aiState.history.length > 20) aiState.history = aiState.history.slice(-20);

  const typingId = appendTyping();
  setInputState(true);

  try {
    const data = await chatWithAI(
      aiState.model,
      [{ role: 'system', content: systemPrompt() }, ...aiState.history],
      aiState.temperature,
      2048,
    );

    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    const content = data.choices?.[0]?.message?.content || '';
    if (!content.trim()) throw new Error('Respons kosong. Coba model lain.');

    removeTyping(typingId);
    const msgEl = appendMessage('assistant', content);
    aiState.history.push({ role: 'assistant', content });
    addCopyBtn(msgEl, content);

  } catch (err) {
    removeTyping(typingId);
    let msg = err.message;
    if (msg.includes('credits') || msg.includes('afford')) msg = '❌ Kredit AI habis.';
    if (msg.includes('404') || msg.includes('not found')) msg = '❌ Model tidak tersedia.';
    appendMessage('error', msg);
    aiState.history.pop();
  } finally {
    aiState.busy = false;
    setInputState(false);
    aiDom.input.focus();
  }
}

// ── UI ────────────────────────────────────────────────
function appendMessage(role, content) {
  aiDom.messages.querySelector('.ai-welcome')?.remove();
  const div = document.createElement('div');
  div.className = `ai-msg ai-msg-${role}`;
  const t = new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
  if (role === 'user') {
    div.innerHTML = `<div class="ai-msg-avatar">👤</div>
      <div class="ai-msg-bubble">
        <div class="ai-msg-content">${escHtml(content)}</div>
        <div class="ai-msg-time">${t}</div></div>`;
  } else if (role === 'assistant') {
    div.innerHTML = `<div class="ai-msg-avatar">🤖</div>
      <div class="ai-msg-bubble">
        <div class="ai-msg-content">${renderMarkdown(content)}</div>
        <div class="ai-msg-time">${t}</div></div>`;
  } else {
    div.innerHTML = `<div class="ai-msg-error">⚠️ ${escHtml(content)}</div>`;
  }
  aiDom.messages.appendChild(div);
  aiDom.messages.scrollTop = aiDom.messages.scrollHeight;
  return div;
}

function appendTyping() {
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.id = id; div.className = 'ai-msg ai-msg-assistant';
  div.innerHTML = `<div class="ai-msg-avatar">🤖</div>
    <div class="ai-msg-bubble">
      <div class="ai-typing-dots"><span></span><span></span><span></span></div></div>`;
  aiDom.messages.appendChild(div);
  aiDom.messages.scrollTop = aiDom.messages.scrollHeight;
  return id;
}

function removeTyping(id) { document.getElementById(id)?.remove(); }

function addCopyBtn(msgEl, content) {
  const btn = document.createElement('button');
  btn.className = 'ai-copy-btn'; btn.textContent = '📋 Salin';
  btn.addEventListener('click', () => {
    navigator.clipboard.writeText(content).then(() => {
      btn.textContent = '✅ Disalin';
      setTimeout(() => { btn.textContent = '📋 Salin'; }, 2000);
    });
  });
  msgEl.querySelector('.ai-msg-time')?.appendChild(btn);
}

function setInputState(disabled) {
  aiDom.input.disabled   = disabled;
  aiDom.sendBtn.disabled = disabled;
  aiDom.sendIcon.textContent = disabled ? '⏳' : '➤';
}

function openPanel() {
  aiState.panelOpen = true;
  aiDom.panel.classList.add('open');
  aiDom.overlay.classList.add('open');
  aiDom.fabBadge.style.display = 'none';
  updateContextInfo();
  aiDom.input.focus();
}

function closePanel() {
  aiState.panelOpen = false;
  aiDom.panel.classList.remove('open');
  aiDom.overlay.classList.remove('open');
}

// ── INIT ──────────────────────────────────────────────
export function initAiAgent() {
  // Populate models
  AI_MODELS.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id; opt.textContent = m.label;
    if (m.id === AI_DEFAULT_MODEL) opt.selected = true;
    aiDom.modelSelect.appendChild(opt);
  });
  aiDom.modelLabel.textContent = AI_MODELS.find(m => m.id === AI_DEFAULT_MODEL)?.label || AI_DEFAULT_MODEL;

  aiDom.fab.addEventListener('click', () => aiState.panelOpen ? closePanel() : openPanel());
  aiDom.closeBtn.addEventListener('click', closePanel);
  aiDom.overlay.addEventListener('click', closePanel);
  aiDom.clearBtn.addEventListener('click', () => {
    if (!confirm('Hapus riwayat?')) return;
    aiState.history = [];
    aiDom.messages.innerHTML = `<div class="ai-welcome">
      <div class="ai-welcome-icon">🤖</div>
      <div class="ai-welcome-title">Chat dikosongkan</div></div>`;
  });
  aiDom.settingsBtn.addEventListener('click', () => {
    const v = aiDom.settingsPanel.style.display !== 'none';
    aiDom.settingsPanel.style.display = v ? 'none' : 'block';
  });
  aiDom.modelSelect.addEventListener('change', e => {
    aiState.model = e.target.value;
    aiDom.modelLabel.textContent = AI_MODELS.find(m => m.id === aiState.model)?.label || aiState.model;
  });
  aiDom.tempSlider.addEventListener('input', e => {
    aiState.temperature = parseFloat(e.target.value);
    aiDom.tempVal.textContent = aiState.temperature.toFixed(1);
  });
  aiDom.langSelect.addEventListener('change', e => { aiState.lang = e.target.value; });
  aiDom.quickActions.addEventListener('click', e => {
    const btn = e.target.closest('.ai-quick-btn');
    if (!btn) return;
    if (!aiState.panelOpen) openPanel();
    aiDom.input.value = btn.dataset.prompt;
    handleSend();
  });
  aiDom.sendBtn.addEventListener('click', handleSend);
  aiDom.input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  aiDom.input.addEventListener('input', () => {
    aiDom.input.style.height = 'auto';
    aiDom.input.style.height = Math.min(aiDom.input.scrollHeight, 120) + 'px';
  });
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.key === 'A') { e.preventDefault(); aiState.panelOpen ? closePanel() : openPanel(); }
  });
  setInterval(() => { if (aiState.panelOpen) updateContextInfo(); }, 5000);
}

function handleSend() {
  const msg = aiDom.input.value.trim();
  if (!msg || aiState.busy) return;
  aiDom.input.value = '';
  aiDom.input.style.height = 'auto';
  sendToAI(msg);
}
