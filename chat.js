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

    .mm-recipe-card {
      background: #fff; border: 1.5px solid #e0ddd8; border-radius: 12px;
      overflow: hidden; margin-top: 4px; max-width: 100%;
    }
    .mm-recipe-card img {
      width: 100%; height: 110px; object-fit: cover; display: block;
    }
    .mm-recipe-card-body { padding: 10px 12px 12px; }
    .mm-recipe-card-title { font-weight: 700; font-size: 0.875rem; color: #1a1a1a; margin-bottom: 4px; }
    .mm-recipe-card-desc  { font-size: 0.775rem; color: #777; line-height: 1.45; margin-bottom: 8px; }
    .mm-recipe-card-link  {
      display: inline-block; background: #3a7d44; color: #fff;
      font-size: 0.75rem; font-weight: 700; padding: 6px 14px;
      border-radius: 6px; text-decoration: none; letter-spacing: 0.04em;
      transition: background 0.2s;
    }
    .mm-recipe-card-link:hover { background: #2e6636; }

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

  // ── RECIPE-ADD HELPERS ──────────────────────────────────────────────
  function aiRecipePhoto(title, tags) {
    const q = ((title || '') + ' ' + (tags || '')).toLowerCase();
    const map = [
      { k: ['pasta','spaghetti','linguine','penne','ramen','noodle','fettuccine','udon','rigatoni'], u: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=85' },
      { k: ['mushroom'], u: 'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=800&q=85' },
      { k: ['rice','grain','quinoa','pilaf','risotto'], u: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&q=85' },
      { k: ['soup','stew','chili','chowder','broth','bisque','lentil','chickpea','minestrone'], u: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=85' },
      { k: ['salad','greens','lettuce','kale','arugula','slaw','caesar'], u: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=85' },
      { k: ['pizza','flatbread','calzone'], u: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=85' },
      { k: ['taco','burrito','quesadilla','enchilada','fajita','tortilla'], u: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800&q=85' },
      { k: ['salmon','fish','seafood','shrimp','tuna','cod','tilapia'], u: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=85' },
      { k: ['chicken','turkey','poultry','wing','drumstick'], u: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&q=85' },
      { k: ['egg','omelette','frittata','scramble','quiche'], u: 'https://images.unsplash.com/photo-1510693206972-df098062cb71?w=800&q=85' },
      { k: ['burger','sandwich','sub','panini','wrap'], u: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=85' },
      { k: ['curry','tikka','masala','korma','dal'], u: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=85' },
      { k: ['stir fry','stir-fry','wok','asian','chinese','korean','thai','teriyaki'], u: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=85' },
      { k: ['beef','steak','pork','meat','ribs','meatball'], u: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=85' },
      { k: ['cake','cupcake','cookie','brownie','dessert','chocolate','muffin','pie'], u: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=85' },
      { k: ['bread','toast','bagel','biscuit','sourdough','roll'], u: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=800&q=85' },
      { k: ['pancake','waffle','crepe','french toast','breakfast'], u: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=800&q=85' },
      { k: ['smoothie','juice','shake','blend','acai'], u: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=800&q=85' },
      { k: ['roast','baked','sheet pan','vegetable','veggie','vegan','tofu'], u: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=85' },
    ];
    for (const e of map) { if (e.k.some(k => q.includes(k))) return e.u; }
    return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=85';
  }

  function aiRecipeEmoji(title) {
    const t = (title || '').toLowerCase();
    const em = [
      { k: ['pasta','spaghetti','noodle','ramen'], e: '🍝' }, { k: ['pizza'], e: '🍕' },
      { k: ['burger','sandwich'], e: '🍔' }, { k: ['taco','burrito'], e: '🌮' },
      { k: ['soup','stew','chili'], e: '🍲' }, { k: ['salad'], e: '🥗' },
      { k: ['rice','bowl'], e: '🍚' }, { k: ['chicken'], e: '🍗' },
      { k: ['fish','salmon','shrimp','seafood'], e: '🐟' }, { k: ['steak','beef','pork','meat'], e: '🥩' },
      { k: ['egg','omelette'], e: '🍳' }, { k: ['cake','dessert','cookie','brownie'], e: '🎂' },
      { k: ['bread','toast'], e: '🍞' }, { k: ['pancake','waffle'], e: '🥞' },
      { k: ['smoothie','juice'], e: '🥤' }, { k: ['curry'], e: '🍛' },
    ];
    for (const e of em) { if (e.k.some(k => t.includes(k))) return e.e; }
    return '🍽️';
  }

  function saveRecipeFromAI(data) {
    try {
      const user = JSON.parse(localStorage.getItem('mm_current_user') || 'null');
      const uid  = user && (user.username || user.name);
      const key  = uid ? 'mm_user_recipes_' + uid : 'mm_user_recipes';
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      const recipe = {
        id:          Date.now(),
        title:       data.title       || 'AI Recipe',
        desc:        data.desc        || '',
        tags:        data.tags        || '',
        emoji:       aiRecipeEmoji(data.title),
        ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
        steps:       Array.isArray(data.steps)       ? data.steps       : [],
        photoUrl:    aiRecipePhoto(data.title, data.tags),
        addedByAI:   true,
      };
      list.push(recipe);
      localStorage.setItem(key, JSON.stringify(list));
      return recipe;
    } catch(e) { console.error('saveRecipeFromAI:', e); return null; }
  }

  function showAddedRecipeCard(recipe) {
    const div = document.createElement('div');
    div.className = 'mm-msg mm-msg-ai';
    div.innerHTML = `<div class="mm-recipe-card">
      <img src="${recipe.photoUrl}" alt="${recipe.title}" loading="lazy" />
      <div class="mm-recipe-card-body">
        <div class="mm-recipe-card-title">${recipe.emoji} ${recipe.title}</div>
        ${recipe.desc ? `<div class="mm-recipe-card-desc">${recipe.desc}</div>` : ''}
        <a class="mm-recipe-card-link" href="recipes.html">View in Recipe Library →</a>
      </div>
    </div>`;
    msgList.appendChild(div);
    msgList.scrollTop = msgList.scrollHeight;
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

Tailor every response to their budget, restrictions, and what they have on hand. Keep answers under 150 words unless a recipe requires more detail.

ADDING RECIPES TO THE LIBRARY: When the user asks to add a recipe to their library (e.g. "add this to my library", "save that recipe", "add a recipe for X", "can you add that"), write a short friendly confirmation sentence, then append this EXACT marker at the very end with nothing after it:
RECIPE_ADD:{"title":"Recipe Name","desc":"One sentence description.","ingredients":["2 cups ingredient","1 tbsp ingredient"],"steps":["Step one sentence.","Step two sentence."],"tags":""}
Rules: tags must be exactly one of "Vegetarian", "Quick & Easy", "High Protein", "Budget-Friendly", or "". Format each ingredient as "amount unit ingredient-name". Each step is one action sentence. Do not wrap in code blocks.`;

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

        const rawReply = data?.content?.[0]?.text
          || "Sorry, I couldn't get a response right now — try again in a moment!";

        // Check for recipe-add action
        const MARKER = 'RECIPE_ADD:';
        const markerIdx = rawReply.indexOf(MARKER);
        let displayReply = rawReply;
        let addedRecipe  = null;

        if (markerIdx !== -1) {
          try {
            const jsonStr = rawReply.slice(markerIdx + MARKER.length).trim();
            const recipeData = JSON.parse(jsonStr);
            addedRecipe  = saveRecipeFromAI(recipeData);
            displayReply = rawReply.slice(0, markerIdx).trim();
          } catch(parseErr) {
            console.warn('Recipe JSON parse failed:', parseErr);
            displayReply = rawReply.replace(/RECIPE_ADD:[\s\S]*$/, '').trim() || rawReply;
          }
        }

        if (displayReply) appendMsg(displayReply, 'ai');
        if (addedRecipe)  showAddedRecipeCard(addedRecipe);

        history.push({ role: 'assistant', content: displayReply || rawReply });
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
