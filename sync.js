// sync.js — 数据同步层（Supabase 版）
// 不需要任何 Netlify Functions，直接从浏览器读写 Supabase

(function () {
  'use strict';

  const SUPABASE_URL = 'https://lektpxffpntsztkodesm.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxla3RweGZmcG50c3p0a29kY3NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MzA5ODksImV4cCI6MjA5NDQwNjk4OX0.lEwURRGQQNx8Sn6hGwHbPsneb2M6VjIPCM18Ijva2LU';
  const TABLE = 'couple_data';
  const SESSION_KEY = 'app_session_pw';
  const CORRECT_PASSWORD = '1234'; // 改成你们的密码

  // ── 密码管理 ──
  function getPassword() { return sessionStorage.getItem(SESSION_KEY) || ''; }
  window.setAppPassword = function (pw) { sessionStorage.setItem(SESSION_KEY, pw); };
  window.clearAppPassword = function () { sessionStorage.removeItem(SESSION_KEY); };
  window.isLoggedIn = function () { return sessionStorage.getItem(SESSION_KEY) === CORRECT_PASSWORD; };

  // ── Supabase REST API ──
  async function sbGet(key) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?key=eq.${encodeURIComponent(key)}&select=value`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    if (!res.ok) throw new Error('DB read failed');
    const rows = await res.json();
    return rows.length ? rows[0].value : null;
  }

  async function sbSet(key, value) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({ key, value })
      }
    );
    if (!res.ok) throw new Error('DB write failed');
  }

  // ── 内存缓存 ──
  const cache = { our_places_v2: [], our_wishes: [] };

  async function preloadAll() {
    const [places, wishes] = await Promise.all([
      sbGet('our_places_v2'),
      sbGet('our_wishes')
    ]);
    cache.our_places_v2 = places || [];
    cache.our_wishes = wishes || [];
  }

  // ── 同步读（从缓存）+ 异步持久化 ──
  window.loadPlaces = function () { return cache.our_places_v2; };
  window.loadWishes = function () { return cache.our_wishes; };

  window.savePlaces = function (data) {
    cache.our_places_v2 = data;
    sbSet('our_places_v2', data).catch(console.error);
  };
  window.saveWishes = function (data) {
    cache.our_wishes = data;
    sbSet('our_wishes', data).catch(console.error);
  };

  // ── 密码页 UI ──
  function showLoginScreen(onSuccess) {
    document.body.style.overflow = 'hidden';
    const overlay = document.createElement('div');
    overlay.id = 'loginOverlay';
    overlay.setAttribute('style',
      'position:fixed;inset:0;z-index:9999;background:var(--bg,#fdf6ee);' +
      "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
      "gap:20px;padding:40px 32px;font-family:'Noto Serif SC',serif;pointer-events:all;"
    );
    overlay.innerHTML =
      '<div style="font-size:52px">💌</div>' +
      '<div style="font-family:\'Ma Shan Zheng\',cursive;font-size:26px;color:var(--rose,#c97b6e);letter-spacing:4px">每日情书</div>' +
      '<div style="font-size:12px;color:var(--ink2,#9e8070);letter-spacing:3px;margin-top:-12px">只写给你</div>' +
      '<div style="width:100%;max-width:280px;margin-top:12px">' +
        '<input id="loginPwInput" type="password" placeholder="输入访问密码" autocomplete="current-password"' +
          ' style="width:100%;box-sizing:border-box;padding:13px 16px;border:1px solid var(--border,#e2d5c8);' +
          'border-radius:4px;font-size:15px;font-family:\'Noto Serif SC\',serif;' +
          'background:var(--bg2,#fff9f3);color:var(--ink,#3d2b1f);' +
          'outline:none;text-align:center;letter-spacing:6px"/>' +
        '<div id="loginError" style="color:#c0524a;font-size:11px;letter-spacing:2px;text-align:center;margin-top:8px;min-height:16px"></div>' +
        '<button id="loginBtn"' +
          ' style="width:100%;margin-top:10px;padding:13px;background:var(--rose,#c97b6e);' +
          'border:none;border-radius:4px;color:#fff;font-size:13px;letter-spacing:4px;' +
          'font-family:\'Noto Serif SC\',serif;cursor:pointer">进入 ❤️</button>' +
      '</div>';
    document.body.appendChild(overlay);

    var input = document.getElementById('loginPwInput');
    var btn = document.getElementById('loginBtn');
    var errEl = document.getElementById('loginError');

    function tryLogin() {
      var pw = input.value.trim();
      if (!pw) return;
      if (pw !== CORRECT_PASSWORD) {
        errEl.textContent = '密码错误，再试试 🔒';
        setTimeout(function () { errEl.textContent = ''; }, 2500);
        input.value = '';
        input.focus();
        return;
      }
      // 密码正确，加载数据
      btn.disabled = true;
      btn.textContent = '加载中…';
      setAppPassword(pw);
      preloadAll().then(function () {
        var el = document.getElementById('loginOverlay');
        if (el) el.remove();
        document.body.style.overflow = '';
        document.body.style.pointerEvents = '';
        onSuccess();
      }).catch(function (e) {
        console.error(e);
        // 数据库连接失败时也放行，用空数据
        var el = document.getElementById('loginOverlay');
        if (el) el.remove();
        document.body.style.overflow = '';
        document.body.style.pointerEvents = '';
        onSuccess();
      });
    }

    btn.addEventListener('click', tryLogin);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryLogin(); });
    setTimeout(function () { input.focus(); }, 100);
  }

  // ── 启动 ──
  function boot(onReady) {
    if (isLoggedIn()) {
      preloadAll().then(onReady).catch(function () {
        // 网络问题时用空缓存放行
        onReady();
      });
    } else {
      showLoginScreen(onReady);
    }
  }

  function init() {
    boot(function () {
      window.__dataReady = true;
      if (typeof window.__onDataReady === 'function') window.__onDataReady();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
