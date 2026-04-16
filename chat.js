// Meal Mate AI Chat Widget
// Floating assistant that appears on every page, personalized from user's localStorage profile

(function () {
  // Don't run on the onboarding page
  if (window.location.pathname.includes('onboarding')) return;

  // ── CONFIG ──────────────────────────────────────────────────────────
  const WORKER_URL = 'https://meal-mate-ai.banksharrison2.workers.dev';

  // ── USER CONTEXT ────────────────────────────────────────────────────
  function getUserContext() {
    try {
      const user = JSON.parse(localStorage.getItem('mm_current_user') || '{}');
      const anonPantry = JSON.parse(localStorage.getItem('mm_pantry') || '[]');
      let ctx = '';
      if (user.budget)    ctx += `Weekly grocery budget: $${user.budget}. `;
      if (user.diet?.length)       ctx += `Dietary restrictions: ${user.diet.join(', ')}. `;
      if (user.allergies?.length)  ctx += `Allergies: ${user.allergies.join(', ')}. `;
      if (user.equipment?.length)  ctx += `Kitchen equipment: ${user.equipment.join(', ')}. `;
      if (user.goals?.length)      ctx += `Health goals: ${user.goals.join(', ')}. `;
      const pantryItems = (user.pantry?.length ? user.pantry : anonPantry);
      if (pantryItems.length) ctx += `Pantry items on hand: ${pantryItems.join(', ')}. `;
      return ctx || 'No profile set up yet — general student on a budget.';
    } catch (e) {
      return 'No profile set up yet — general student on a budget.';
    }
  }

  // ── STYLES ──────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #mm-chat-bubble {
      position: fixed; bottom: 28px; right: 28px;
      width: 58px; height: 58px;
      background: #C75F2F; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 9999;
      box-shadow: 0 4px 20px rgba(199,95,47,0.45);
      transition: transform 0.2s, box-shadow 0.2s;
      border: none;
    }
    #mm-chat-bubble:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(199,95,47,0.55); }
    #mm-chat-bubble svg { pointer-events: none; }

    #mm-chat-window {
      position: fixed; bottom: 100px; right: 28px;
      width: 360px; max-height: 520px;
      background: #FFFDF9; border-radius: 20px;
      box-shadow: 0 10px 48px rgba(61,52,46,0.18);
      display: none; flex-direction: column;
      z-index: 9998; overflow: hidden;
      font-family: 'DM Sans', sans-serif;
      animation: mmSlideIn 0.22s ease;
    }
    #mm-chat-window.open { display: flex; }
    @keyframes mmSlideIn {
      from { opacity: 0; transform: translateY(12px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    #mm-chat-header {
      background: #C75F2F; padding: 14px 16px;
      display: flex; align-items: center; justify-content: space-between;
      flex-shrink: 0;
    }
    #mm-chat-title { display: flex; align-items: center; gap: 10px; }
    #mm-chat-avatar { font-size: 1.5rem; line-height: 1; }
    #mm-chat-name  { color: #FFFDF9; font-weight: 700; font-size: 0.95rem; line-height: 1.2; }
    #mm-chat-sub   { color: rgba(255,253,249,0.75); font-size: 0.72rem; margin-top: 1px; }
    #mm-chat-close {
      background: rgba(255,255,255,0.2); border: none; color: #fff;
      width: 28px; height: 28px; border-radius: 50%; font-size: 1.1rem;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: background 0.15s; line-height: 1;
    }
    #mm-chat-close:hover { background: rgba(255,255,255,0.35); }

    #mm-chat-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 10px;
    }
    #mm-chat-messages::-webkit-scrollbar { width: 4px; }
    #mm-chat-messages::-webkit-scrollbar-thumb { background: #e0d5cc; border-radius: 4px; }

    .mm-msg { display: flex; max-width: 88%; }
    .mm-msg-ai   { align-self: flex-start; }
    .mm-msg-user { align-self: flex-end; }
    .mm-msg-text {
      padding: 10px 14px; border-radius: 18px;
      font-size: 0.875rem; line-height: 1.55; word-break: break-word;
    }
    .mm-msg-ai   .mm-msg-text { background: #FAE1CC; color: #3D342E; border-bottom-left-radius: 5px; }
    .mm-msg-user .mm-msg-text { background: #C75F2F; color: #FFFDF9; border-bottom-right-radius: 5px; }

    .mm-typing .mm-msg-text { background: #FAE1CC; color: #7a6a5f; }
    .mm-typing-dots { display: inline-flex; gap: 4px; align-items: center; height: 18px; }
    .mm-typing-dots span {
      width: 7px; height: 7px; background: #C75F2F; border-radius: 50%;
      animation: mmDot 1.2s infinite ease-in-out;
    }
    .mm-typing-dots span:nth-child(2) { animation-delay: 0.2s; }
    .mm-typing-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes mmDot {
      0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
      40%            { transform: scale(1);   opacity: 1;   }
    }

    #mm-chat-input-row {
      padding: 12px; border-top: 1px solid #e0d5cc;
      display: flex; gap: 8px; align-items: center; flex-shrink: 0;
    }
    #mm-chat-input {
      flex: 1; border: 1.5px solid #e0d5cc; border-radius: 20px;
      padding: 9px 14px; font-family: 'DM Sans', sans-serif;
      font-size: 0.875rem; color: #3D342E; background: #F0EBE3; outline: none;
      transition: border-color 0.2s;
    }
    #mm-chat-input:focus { border-color: #C75F2F; }
    #mm-chat-input::placeholder { color: #a89c95; }
    #mm-chat-send {
      width: 38px; height: 38px; background: #C75F2F; border: none;
      border-radius: 50%; cursor: pointer; display: flex;
      align-items: center; justify-content: center; flex-shrink: 0;
      transition: background 0.2s; padding: 0;
    }
    #mm-chat-send:hover:not(:disabled) { background: #a84d22; }
    #mm-chat-send:disabled { background: #d4a090; cursor: not-allowed; }

    @media (max-width: 480px) {
      #mm-chat-window { width: calc(100vw - 24px); right: 12px; bottom: 90px; }
      #mm-chat-bubble { bottom: 20px; right: 16px; }
    }
  `;
  document.head.appendChild(style);

  // ── HTML ────────────────────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <button id="mm-chat-bubble" aria-label="Open Meal Mate AI assistant">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              fill="white" opacity="0.95"/>
      </svg>
    </button>
    <div id="mm-chat-window" role="dialog" aria-label="Meal Mate AI chat">
      <div id="mm-chat-header">
        <div id="mm-chat-title">
          <span id="mm-chat-avatar">🥗</span>
          <div>
            <div id="mm-chat-name">Meal Mate AI</div>
            <div id="mm-chat-sub">Your personal food assistant</div>
          </div>
        </div>
        <button id="mm-chat-close" aria-label="Close chat">✕</button>
      </div>
      <div id="mm-chat-messages" aria-live="polite">
        <div class="mm-msg mm-msg-ai">
          <span class="mm-msg-text">Hi! I'm your Meal Mate assistant 👋 Ask me for recipe ideas, what to cook with your pantry, how to stretch your budget, or any other food questions!</span>
        </div>
      </div>
      <div id="mm-chat-input-row">
        <input id="mm-chat-input" type="text" placeholder="Ask anything about food…" maxlength="500" autocomplete="off"/>
        <button id="mm-chat-send" aria-label="Send message">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <line x1="22" y1="2" x2="11" y2="13" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2" fill="white" opacity="0.9"/>
          </svg>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  // ── STATE & REFS ────────────────────────────────────────────────────
  let isOpen = false;
  let isLoading = false;
  let history = []; // { role, content }[]

  const bubble   = document.getElementById('mm-chat-bubble');
  const chatWin  = document.getElementById('mm-chat-window');
  const closeBtn = document.getElementById('mm-chat-close');
  const input    = document.getElementById('mm-chat-input');
  const sendBtn  = document.getElementById('mm-chat-send');
  const msgList  = document.getElementById('mm-chat-messages');

  // ── HELPERS ─────────────────────────────────────────────────────────
  function toggle() {
    isOpen = !isOpen;
    chatWin.classList.toggle('open', isOpen);
    if (isOpen) { setTimeout(() => input.focus(), 60); }
  }

  function appendMsg(text, role) {
    const div = document.createElement('div');
    div.className = 'mm-msg mm-msg-' + (role === 'user' ? 'user' : 'ai');
    // Basic markdown: bold, line breaks
    const safe = text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
    div.innerHTML = `<span class="mm-msg-text">${safe}</span>`;
    msgList.appendChild(div);
    msgList.scrollTop = msgList.scrollHeight;
    return div;
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'mm-msg mm-msg-ai mm-typing';
    div.id = 'mm-typing-indicator';
    div.innerHTML = `<span class="mm-msg-text"><span class="mm-typing-dots"><span></span><span></span><span></span></span></span>`;
    msgList.appendChild(div);
    msgList.scrollTop = msgList.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById('mm-typing-indicator');
    if (el) el.remove();
  }

  // ── SEND ────────────────────────────────────────────────────────────
  async function send() {
    const text = input.value.trim();
    if (!text || isLoading) return;

    input.value = '';
    isLoading = true;
    sendBtn.disabled = true;

    appendMsg(text, 'user');
    history.push({ role: 'user', content: text });
    showTyping();

    const systemPrompt = `You are Meal Mate, a friendly AI food assistant for college students. Be concise, warm, and practical. Use emojis occasionally (not excessively).

You help with: recipe ideas, using pantry items creatively, budget meal planning, reducing food waste, and building healthy eating habits. If asked about something completely unrelated to food, cooking, or nutrition, kindly steer back to your specialty.

This user's profile:
${getUserContext()}

Tailor every response to their budget, restrictions, and what they have on hand. Keep answers under 150 words unless a recipe requires more detail.`;

    const payload = JSON.stringify({ system: systemPrompt, messages: history });
    const MAX_RETRIES = 3;
    let lastErr;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });

        const data = await res.json();
        hideTyping();

        const reply = data?.content?.[0]?.text
          || "Sorry, I couldn't get a response right now — try again in a moment!";

        appendMsg(reply, 'ai');
        history.push({ role: 'assistant', content: reply });
        lastErr = null;
        break; // success — stop retrying

      } catch (err) {
        lastErr = err;
        // Small delay before retrying (300ms, 600ms)
        if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, attempt * 300));
      }
    }

    if (lastErr) {
      hideTyping();
      appendMsg("Sorry, I'm having a little trouble right now — please try again!", 'ai');
    }

    isLoading = false;
    sendBtn.disabled = false;
    input.focus();
  }

  // ── EVENTS ──────────────────────────────────────────────────────────
  bubble.addEventListener('click', toggle);
  closeBtn.addEventListener('click', toggle);
  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) send(); });

  // Close on outside click
  document.addEventListener('click', e => {
    if (isOpen && !chatWin.contains(e.target) && e.target !== bubble) toggle();
  });

})();
