tailwind.config = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      },
      colors: {
        brand: { 50: '#FFF7ED', 100: '#FFEDD5', 200: '#FED7AA', 300: '#FDBA74', 400: '#FB923C', 500: '#F97316', 600: '#EA580C', 700: '#C2410C', 800: '#9A3412' }
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.06)',
        lift: '0 18px 40px -18px rgba(15,23,42,.35)'
      }
    }
  }
};

window.EZX = (() => {
  const KEY = 'ezx-demo-v1';
  const listeners = [];
  let lastRev = 0;
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ezx-demo') : null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  };
  const bootResetAt = read().resetAt || 0;
  const emit = s => {
    if (!s || (s.rev || 0) <= lastRev) return;
    lastRev = s.rev;
    if ((s.resetAt || 0) !== bootResetAt) { location.reload(); return; }
    listeners.forEach(fn => fn(s));
  };

  function get() { return read(); }
  function set(patch) {
    const s = { ...read(), ...patch, rev: Date.now() };
    lastRev = s.rev;
    localStorage.setItem(KEY, JSON.stringify(s));
    channel?.postMessage(s);
    return s;
  }
  function on(fn) { listeners.push(fn); }
  function log(actor, text, scope = 'B') {
    const s = read();
    const entries = [...(s.log || []), { t: Date.now(), actor, text, scope }];
    return set({ log: entries });
  }
  function reset() {
    set({ seller: null, log: [], resetAt: Date.now() });
    location.reload();
  }

  if (channel) channel.onmessage = e => emit(e.data);
  window.addEventListener('storage', e => { if (e.key === KEY) emit(read()); });

  const sleep = ms => new Promise(r => setTimeout(r, reduced ? 0 : ms));

  const tr = (v, sign = false) => {
    const r = Math.round(v * 10) / 10;
    return (sign && r > 0 ? '+' : '') + r.toLocaleString('vi-VN') + 'tr';
  };

  const pct = (v, dec = 1) => (v * 100).toLocaleString('vi-VN', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + '%';

  function countUp(el, to, { dur = 800, dec = 0, prefix = '', suffix = '', locale = 'vi-VN' } = {}) {
    if (!el) return;
    const from = 0;
    const token = el._countToken = (el._countToken || 0) + 1;
    const fmt = v => prefix + v.toLocaleString(locale, { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix;
    if (reduced) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const step = now => {
      if (el._countToken !== token) return;
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function setText(el, text) {
    if (!el) return;
    el._countToken = (el._countToken || 0) + 1;
    el.textContent = text;
  }

  function icons() {
    if (window.lucide) lucide.createIcons({ attrs: { 'stroke-width': 1.75 } });
  }

  function toast(msg, tone = 'dark') {
    let host = document.getElementById('toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toast-host';
      host.setAttribute('aria-live', 'polite');
      host.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 pointer-events-none';
      document.body.appendChild(host);
    }
    const tones = {
      dark: 'bg-slate-900 text-white',
      ok: 'bg-emerald-600 text-white',
      warn: 'bg-amber-500 text-slate-900',
      err: 'bg-rose-600 text-white'
    };
    const el = document.createElement('div');
    el.className = `fade-up pointer-events-auto rounded-xl px-4 py-2.5 text-sm font-medium shadow-lift ${tones[tone] || tones.dark}`;
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; }, 2600);
    setTimeout(() => el.remove(), 3000);
  }

  function hash(str) {
    let h1 = 0x811c9dc5, h2 = 0x1b873593;
    for (let i = 0; i < str.length; i++) {
      h1 = Math.imul(h1 ^ str.charCodeAt(i), 16777619);
      h2 = Math.imul(h2 ^ str.charCodeAt(i), 2246822507);
    }
    const hex = n => (n >>> 0).toString(16).padStart(8, '0');
    return `sha256:${hex(h1).slice(0, 4)}…${hex(h2).slice(0, 4)}`;
  }

  const clock = (t = Date.now()) => new Date(t).toLocaleTimeString('vi-VN', { hour12: false });

  const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const NAV = [
    { href: 'index.html', key: 'home', label: 'Tổng quan', icon: 'layout-grid' },
    { href: '01-seller-portal.html', key: 'seller', label: 'Seller', icon: 'store' },
    { href: '02-lender-cockpit.html', key: 'lender', label: 'Ngân hàng', icon: 'landmark' },
    { href: '03-policy-eval-studio.html', key: 'studio', label: 'Studio', icon: 'cpu' }
  ];

  const ACTIVE = {
    seller: 'bg-brand-50 text-brand-700',
    lender: 'bg-teal-50 text-teal-700',
    studio: 'bg-violet-500/15 text-violet-200',
    home: 'bg-white/10 text-white'
  };

  function header(active, { dark = false, right = '' } = {}) {
    const base = dark
      ? 'bg-slate-950/80 border-white/10 text-slate-200'
      : 'bg-white/85 border-slate-200 text-slate-800';
    const idle = dark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100';
    const nav = NAV.map(n => `
      <a href="${n.href}" ${n.key === active ? 'aria-current="page"' : ''}
         class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors duration-200 ${n.key === active ? ACTIVE[active] + ' font-medium' : idle}">
        <i data-lucide="${n.icon}" class="w-4 h-4"></i><span class="hidden sm:inline">${n.label}</span>
      </a>`).join('');
    return `
      <header class="sticky top-0 z-40 backdrop-blur border-b ${base}">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <a href="index.html" class="flex items-center gap-2 font-semibold tracking-tight">
            <span class="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-amber-400 flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 15c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 3 3"/><path d="M3 9c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 3 3" opacity=".55"/></svg>
            </span>
            <span><span class="text-brand-500">ezX</span>Riverbank</span>
          </a>
          <nav class="flex items-center gap-1" aria-label="Màn hình demo">${nav}</nav>
          <div class="flex items-center gap-3 text-xs">
            ${right}
            <span class="hidden md:flex items-center gap-1.5 ${dark ? 'text-slate-400' : 'text-slate-500'}" title="Các tab Seller và Ngân hàng đồng bộ trạng thái trực tiếp">
              <span class="w-2 h-2 rounded-full bg-emerald-500 ping-soft"></span>Đồng bộ trực tiếp
            </span>
            <button id="ezx-reset" class="flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-colors ${dark ? 'text-slate-400 hover:bg-white/5 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}" title="Xoá trạng thái demo trên mọi tab">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i><span class="hidden lg:inline">Reset demo</span>
            </button>
          </div>
        </div>
      </header>`;
  }

  function mountHeader(active, opts) {
    const host = document.getElementById('app-header');
    if (!host) return;
    host.innerHTML = header(active, opts);
    document.getElementById('ezx-reset').onclick = reset;
    icons();
  }

  return { get, set, on, log, reset, sleep, tr, pct, countUp, setText, icons, toast, hash, clock, escape, mountHeader, reduced };
})();
