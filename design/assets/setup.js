// Shared design tokens, illustrations and helpers for the HTML prototypes (v3).
// Load order: Tailwind CDN, this file, Alpine CDN (defer).

tailwind.config = {
  theme: {
    extend: {
      colors: {
        ink: '#17161A',
        ink2: '#232127',
        cream: '#FFF6EC',
        coral: { DEFAULT: '#F2654F', dark: '#D94F3A', soft: '#FCE4DE' },
        sun: { DEFAULT: '#FFD84D', soft: '#FFF3C4' },
        lilac: { DEFAULT: '#C9C1FF', soft: '#ECE9FF' },
        mint: { DEFAULT: '#8FE0BF', soft: '#DDF6EC' },
        sky: '#DCE6F0',
        champagne: '#E9DCC0',
        bo: { bg: '#F4F4F2', line: '#E5E3DE', text: '#1C1B1F', muted: '#6E6B73', panel: '#FFFFFF' },
        bronze: '#E8894F',
        silver: '#AEB9C6',
        gold: '#FFC23D',
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl2: '14px', xl3: '18px' },
      boxShadow: {
        card: '0 24px 40px -18px rgba(23,22,26,.45)',
        soft: '0 10px 30px -12px rgba(23,22,26,.18)',
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0) rotate(var(--r,0deg))' }, '50%': { transform: 'translateY(-12px) rotate(var(--r,0deg))' } },
        pop: { '0%': { transform: 'scale(.6)', opacity: 0 }, '70%': { transform: 'scale(1.08)', opacity: 1 }, '100%': { transform: 'scale(1)' } },
        rise: { '0%': { transform: 'translateY(0)', opacity: 1 }, '100%': { transform: 'translateY(-90px)', opacity: 0 } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        spinslow: { to: { transform: 'rotate(360deg)' } },
        dash: { to: { strokeDashoffset: '-40' } },
      },
      animation: {
        float: 'float 5s ease-in-out infinite',
        pop: 'pop .5s cubic-bezier(.2,.9,.3,1.3) both',
        rise: 'rise 1.1s ease-out forwards',
        marquee: 'marquee 28s linear infinite',
        spinslow: 'spinslow 18s linear infinite',
        dash: 'dash 1.2s linear infinite',
      },
    },
  },
};

const BRAND = 'Fairly';

const TIERS = [
  { name: 'Bronze', min: 0, color: '#E8894F', perk: 'Free cookie', icon: 'cookie' },
  { name: 'Silver', min: 3, color: '#AEB9C6', perk: 'Size upgrade', icon: 'cup' },
  { name: 'Gold', min: 6, color: '#FFC23D', perk: 'Free drink monthly', icon: 'gift' },
];

const SHOPS = {
  cafe: { name: 'Corner Café', color: '#FF6B57', text: '#17161A', mark: 'cup' },
  barber: { name: 'Fade Barbers', color: '#17161A', text: '#FFFFFF', mark: 'scissors' },
  gym: { name: 'Iron Gym', color: '#C9C1FF', text: '#17161A', mark: 'bolt' },
  bakery: { name: 'Crumb Bakery', color: '#FFE24A', text: '#17161A', mark: 'cookie' },
};

function tierFor(visits) {
  let t = 0;
  TIERS.forEach((x, i) => { if (visits >= x.min) t = i; });
  return t;
}
// Pick readable text color for a background hex.
const readable = hex => { const h = hex.replace('#', ''); const [r, g, b] = [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#17161A' : '#FFFFFF'; };
const money = n => '$' + Number(n).toFixed(2);

// ---------- Illustrations (inline SVG, no external assets) ----------
const ICON = {
  cup: `<path d="M6 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Z" fill="currentColor"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17" stroke="currentColor" stroke-width="2" fill="none"/><path d="M9 3c0 1.5 1.5 1.5 1.5 3M13 3c0 1.5 1.5 1.5 1.5 3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  cookie: `<circle cx="12" cy="12" r="8.5" fill="currentColor"/><circle cx="9" cy="10" r="1.3" fill="#fff" opacity=".8"/><circle cx="14.5" cy="9" r="1" fill="#fff" opacity=".8"/><circle cx="13" cy="14.5" r="1.3" fill="#fff" opacity=".8"/><circle cx="8.8" cy="14.5" r=".9" fill="#fff" opacity=".8"/>`,
  gift: `<rect x="4" y="10" width="16" height="10" rx="2" fill="currentColor"/><rect x="3" y="7" width="18" height="4" rx="1.5" fill="currentColor"/><path d="M12 7v13" stroke="#fff" stroke-width="1.8"/><path d="M12 7c-1.5-3-5-3-4.5-.5.4 1.6 4.5.5 4.5.5Zm0 0c1.5-3 5-3 4.5-.5-.4 1.6-4.5.5-4.5.5Z" fill="currentColor"/>`,
  scissors: `<circle cx="7" cy="17" r="3" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="17" cy="17" r="3" stroke="currentColor" stroke-width="2" fill="none"/><path d="M9 15 18 4M15 15 6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  bolt: `<path d="M13 2 5 13h6l-1 9 8-11h-6l1-9Z" fill="currentColor"/>`,
  qr: `<rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2" fill="none"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2" fill="none"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 18v3" stroke="currentColor" stroke-width="2"/>`,
  home: `<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8Z" fill="currentColor"/>`,
  star: `<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3Z" fill="currentColor"/>`,
  list: `<path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="4" cy="6" r="1.4" fill="currentColor"/><circle cx="4" cy="12" r="1.4" fill="currentColor"/><circle cx="4" cy="18" r="1.4" fill="currentColor"/>`,
  tag: `<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" fill="currentColor"/><circle cx="8" cy="8" r="1.6" fill="#fff"/>`,
  arrow: `<path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  back: `<path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  check: `<path d="m5 12 4.5 4.5L19 7" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  bell: `<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Z" fill="currentColor"/><path d="M10 20a2 2 0 0 0 4 0" fill="currentColor"/>`,
  chart: `<rect x="4" y="12" width="4" height="8" rx="1" fill="currentColor"/><rect x="10" y="7" width="4" height="13" rx="1" fill="currentColor"/><rect x="16" y="3" width="4" height="17" rx="1" fill="currentColor"/>`,
  users: `<circle cx="9" cy="8" r="3.5" fill="currentColor"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0" fill="currentColor"/><circle cx="17" cy="9" r="2.6" fill="currentColor" opacity=".6"/><path d="M15 20a5 5 0 0 1 7-4.6V20" fill="currentColor" opacity=".6"/>`,
  bag: `<path d="M5 8h14l-1 12H6L5 8Z" fill="currentColor"/><path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="2" fill="none"/>`,
  burger: `<path d="M4 11a8 6 0 0 1 16 0H4Z" fill="currentColor"/><rect x="3" y="13" width="18" height="2.5" rx="1.2" fill="currentColor"/><path d="M4 17.5h16a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5Z" fill="currentColor"/>`,
  book: `<path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2V5Z" fill="currentColor"/><path d="M4 20a2 2 0 0 1 2-2h13v3H6a2 2 0 0 1-2-1Z" fill="currentColor" opacity=".5"/>`,
  flower: `<circle cx="12" cy="8" r="3" fill="currentColor"/><circle cx="8" cy="11" r="3" fill="currentColor"/><circle cx="16" cy="11" r="3" fill="currentColor"/><circle cx="12" cy="11" r="2" fill="#fff"/><path d="M12 14v7M12 18c2-2 4-2 5-2" stroke="currentColor" stroke-width="2" fill="none"/>`,
  truck: `<path d="M2 7h12v9H2zM14 10h4l3 3v3h-7z" fill="currentColor"/><circle cx="6" cy="18" r="2" fill="currentColor"/><circle cx="17" cy="18" r="2" fill="currentColor"/>`,
  lotus: `<path d="M12 4c2 3 2 7 0 11-2-4-2-8 0-11Z" fill="currentColor"/><path d="M4 9c4 0 7 3 8 6-4 0-7-2-8-6Zm16 0c-4 0-7 3-8 6 4 0 7-2 8-6Z" fill="currentColor" opacity=".7"/><path d="M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  pin: `<path d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12Z" fill="currentColor"/><circle cx="12" cy="10" r="2.5" fill="#fff"/>`,
  calendar: `<rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  upload: `<path d="M12 16V4M7 9l5-5 5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" stroke="currentColor" stroke-width="2" fill="none"/>`,
  settings: `<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  sparkchart: `<path d="M3 17l5-5 4 3 8-8" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7h5v5" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
  wallet: `<rect x="3" y="6" width="18" height="13" rx="2.5" fill="currentColor"/><path d="M3 9h18" stroke="#fff" stroke-width="1.5" opacity=".5"/><circle cx="16.5" cy="13.5" r="1.5" fill="#fff"/>`,
  card: `<rect x="2" y="5" width="20" height="14" rx="2.5" fill="currentColor"/><rect x="2" y="8.5" width="20" height="2.5" fill="#fff" opacity=".5"/>`,
  link: `<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  phone: `<rect x="6" y="2.5" width="12" height="19" rx="2.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M10.5 18.5h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  download: `<path d="M12 4v11M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 19h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  chevron: `<path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  search: `<circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  plus: `<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`,
  x: `<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`,
  tablet: `<rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="18.2" cy="12" r=".9" fill="currentColor"/>`,
};
const icon = (name, cls = 'w-6 h-6') => `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true">${ICON[name]}</svg>`;

// Gold coin with a stamp mark and a diagonal shine that sweeps at a random offset.
let _coinId = 0;
const coin = (cls = 'w-10 h-10') => {
  const id = 'cn' + (++_coinId), delay = (Math.random() * 4).toFixed(2);
  return `
<svg viewBox="0 0 48 48" class="${cls}" aria-hidden="true">
  <defs><clipPath id="${id}"><circle cx="24" cy="23" r="20"/></clipPath>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
  <circle cx="24" cy="26" r="20" fill="#E8A21E"/>
  <circle cx="24" cy="23" r="20" fill="#FFC23D"/>
  <circle cx="24" cy="23" r="14.5" fill="none" stroke="#E8A21E" stroke-width="2.4" stroke-dasharray="3 3.2"/>
  <text x="24" y="29.5" text-anchor="middle" font-family="Outfit" font-weight="800" font-size="17" fill="#B9760B">$</text>
  <g clip-path="url(#${id})"><polygon class="coin-shine" points="-40,34 -34,40 40,-34 34,-40" fill="#fff" fill-opacity=".75" style="animation-delay:${delay}s"/></g>
</svg>`;
};

// Loyalty card. Mirrors what /api/art/<slug>/<tier>.svg will return.
function cardArt({ shop = 'cafe', tier = 0, balance = 0, visits = 0, number = '0042', size = 'md', brand = null } = {}) {
  const s = { ...(SHOPS[shop] || SHOPS.cafe), ...(brand || {}) }, t = TIERS[tier], next = TIERS[tier + 1];
  const slots = next ? next.min - t.min : 0, filled = visits - t.min;
  const stamps = next ? Array.from({ length: slots }, (_, i) =>
    `<span class="w-7 h-7 rounded-full grid place-items-center ${i < filled ? '' : 'border-2 border-dashed'}" style="${i < filled ? `background:${s.text};color:${s.color}` : `border-color:${s.text}55`}">${i < filled ? icon(s.mark, 'w-4 h-4') : ''}</span>`).join('') : '';
  const big = size === 'lg';
  return `
  <div class="relative w-full aspect-[1.6] rounded-[20px] overflow-hidden shadow-card select-none" style="background:${s.color};color:${s.text}">
    <div class="absolute -right-8 -top-10 w-52 h-52">
      <svg class="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="5 6"/></svg>
      <div class="absolute left-[30%] top-[38%] w-[34%] h-[34%] opacity-[.14] rotate-[-12deg]">${s.logo ? '' : icon(s.mark, 'w-full h-full')}</div>
    </div>
    <div class="relative h-full p-5 flex flex-col">
      <div class="flex items-center gap-2 min-w-0">
        <span class="w-11 h-11 shrink-0 rounded-full grid place-items-center overflow-hidden" style="background:${s.text};color:${s.color}">${s.logo ? `<img src="${s.logo}" class="w-11 h-11 object-cover" alt="">` : icon(s.mark, 'w-6 h-6')}</span>
        <span class="font-semibold truncate">${s.name}</span>
        <span class="ml-auto text-[11px] opacity-60 shrink-0">No. ${number}</span>
      </div>
      <p class="mt-auto text-xs font-medium opacity-70">Balance</p>
      <p class="${big ? 'text-5xl' : 'text-4xl'} font-extrabold tracking-tight tabular-nums leading-none">${money(balance)}</p>
      <div class="flex items-center gap-1.5 mt-3">${stamps || ''}<span class="ml-auto h-7 px-2.5 rounded-md flex items-center gap-1 text-[11px] font-bold shrink-0" style="background:${t.color};color:#17161A">${icon('star', 'w-3 h-3')}${t.name}</span></div>
    </div>
  </div>`;
}

// Deterministic fake QR for the prototype.
function fakeQR(seed = 'fairly', size = 21, fg = '#17161A') {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => ((h = (h * 1103515245 + 12345) >>> 0) / 4294967296);
  const cell = 6, pad = 1, dim = (size + pad * 2) * cell;
  let r = '';
  const sq = (x, y) => { r += `<rect x="${(x + pad) * cell}" y="${(y + pad) * cell}" width="${cell}" height="${cell}" rx="1.5"/>`; };
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) {
    const f = (i < 8 && j < 8) || (i > size - 9 && j < 8) || (i < 8 && j > size - 9);
    if (!f && rnd() > 0.5) sq(i, j);
  }
  const finder = (x, y) => { r += `<rect x="${(x + pad) * cell + 3}" y="${(y + pad) * cell + 3}" width="${cell * 7 - 6}" height="${cell * 7 - 6}" rx="9" fill="none" stroke="${fg}" stroke-width="6"/><rect x="${(x + 2 + pad) * cell}" y="${(y + 2 + pad) * cell}" width="${cell * 3}" height="${cell * 3}" rx="4"/>`; };
  finder(0, 0); finder(size - 7, 0); finder(0, size - 7);
  return `<svg viewBox="0 0 ${dim} ${dim}" class="w-full h-full" fill="${fg}">${r}</svg>`;
}

// Confetti burst for celebrations.
function confetti(el, n = 28) {
  const colors = ['#FF6B57', '#FFE24A', '#C9C1FF', '#8FE0BF', '#FFC23D'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('span');
    const x = (Math.random() - .5) * 320, y = -Math.random() * 260 - 60, rot = Math.random() * 720;
    p.style.cssText = `position:absolute;left:50%;top:55%;width:9px;height:14px;border-radius:3px;background:${colors[i % 5]};pointer-events:none;transition:transform 1.1s cubic-bezier(.2,.7,.3,1),opacity 1.1s;`;
    el.appendChild(p);
    requestAnimationFrame(() => { p.style.transform = `translate(${x}px,${y}px) rotate(${rot}deg)`; p.style.opacity = '0'; });
    setTimeout(() => p.remove(), 1200);
  }
}

// Reveal-on-scroll helper: add data-reveal to any element. Runs after Alpine renders templates.
function initReveal() {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target; el.classList.add('is-in'); io.unobserve(el);
    // Once revealed, drop the reveal transition so hover effects respond instantly.
    if (!el.hasAttribute('data-keep')) setTimeout(() => { el.removeAttribute('data-delay'); el.removeAttribute('data-reveal'); el.classList.remove('is-in'); }, 1100);
  }), { threshold: .18 });
  document.querySelectorAll('[data-reveal]:not(.is-in)').forEach(el => io.observe(el));
}
document.addEventListener('alpine:initialized', () => setTimeout(initReveal, 50));

// Product illustrations used around the hero phone (no text, no brands). Shaded, layered SVG.
const ILLO = {
  coffee: `<svg viewBox="0 0 140 190" class="w-full h-full">
    <defs>
      <linearGradient id="cupB" x1="0" x2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#F6EFE6"/><stop offset="1" stop-color="#E2D6C6"/></linearGradient>
      <linearGradient id="slv" x1="0" x2="1"><stop offset="0" stop-color="#C98B55"/><stop offset=".5" stop-color="#B07440"/><stop offset="1" stop-color="#8E5A2E"/></linearGradient>
      <linearGradient id="lid" x1="0" x2="1"><stop offset="0" stop-color="#2E2C33"/><stop offset=".5" stop-color="#17161A"/><stop offset="1" stop-color="#0B0A0D"/></linearGradient>
    </defs>
    <ellipse cx="70" cy="182" rx="40" ry="6" fill="#000" opacity=".25"/>
    <path d="M26 50h88l-12 122a10 10 0 0 1-10 9H48a10 10 0 0 1-10-9L26 50Z" fill="url(#cupB)"/>
    <path d="M31 92h78l-5 50H36l-5-50Z" fill="url(#slv)"/>
    <g stroke="#E0A874" stroke-width="1.4" stroke-dasharray="3 3" opacity=".7"><path d="M33 98h74"/><path d="M37 136h66"/></g>
    <circle cx="70" cy="117" r="13" fill="#F2654F"/><path d="M64 117h12M70 111v12" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".9"/>
    <path d="M38 54l9 116" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>
    <rect x="20" y="38" width="100" height="16" rx="7" fill="url(#lid)"/>
    <path d="M30 38c2-12 8-16 16-16h48c8 0 14 4 16 16Z" fill="url(#lid)"/>
    <rect x="60" y="25" width="20" height="5" rx="2.5" fill="#000" opacity=".5"/>
    <path d="M34 43h72" stroke="#fff" stroke-width="2" opacity=".18" stroke-linecap="round"/>
    <g fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".55"><path d="M58 16c-6-6 6-8 0-15"><animate attributeName="opacity" values=".1;.7;.1" dur="3s" repeatCount="indefinite"/></path><path d="M78 16c-6-6 6-8 0-15"><animate attributeName="opacity" values=".6;.1;.6" dur="3s" repeatCount="indefinite"/></path></g>
  </svg>`,
  bag: `<svg viewBox="0 0 150 180" class="w-full h-full">
    <defs>
      <linearGradient id="kraft" x1="0" x2="1"><stop offset="0" stop-color="#D9A86C"/><stop offset=".6" stop-color="#C8915A"/><stop offset="1" stop-color="#A9743F"/></linearGradient>
      <linearGradient id="kraftSide" x1="0" x2="1"><stop offset="0" stop-color="#A9743F"/><stop offset="1" stop-color="#8C5E30"/></linearGradient>
    </defs>
    <ellipse cx="75" cy="174" rx="58" ry="6" fill="#000" opacity=".22"/>
    <path d="M40 58c0-26 12-40 26-40s26 14 26 40" fill="none" stroke="#17161A" stroke-width="5" stroke-linecap="round"/>
    <path d="M58 58c0-24 12-36 26-36s26 12 26 36" fill="none" stroke="#2E2C33" stroke-width="5" stroke-linecap="round"/>
    <path d="M18 56h96l6 112H12L18 56Z" fill="url(#kraft)"/>
    <path d="M114 56l24 10-4 102h-14Z" fill="url(#kraftSide)"/>
    <path d="M18 56h96v12H17Z" fill="#B8824B"/>
    <path d="M114 56l24 10v10l-24-10Z" fill="#8C5E30"/>
    <g fill="#F6EFE6"><circle cx="42" cy="66" r="3.5"/><circle cx="90" cy="66" r="3.5"/></g>
    <rect x="38" y="96" width="56" height="40" rx="6" fill="#FFF6EC"/>
    <circle cx="66" cy="116" r="11" fill="#F2654F"/><path d="M61 116l4 4 7-8" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M24 70l-4 92" stroke="#fff" stroke-width="4" opacity=".25" stroke-linecap="round"/>
  </svg>`,
  croissant: `<svg viewBox="0 0 200 120" class="w-full h-full">
    <defs>
      <radialGradient id="crA" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#F7C67A"/><stop offset=".6" stop-color="#E39A42"/><stop offset="1" stop-color="#B86A22"/></radialGradient>
      <radialGradient id="crB" cx=".5" cy=".25" r=".9"><stop offset="0" stop-color="#FBD594"/><stop offset=".7" stop-color="#E8A350"/><stop offset="1" stop-color="#C47629"/></radialGradient>
    </defs>
    <ellipse cx="100" cy="112" rx="80" ry="7" fill="#000" opacity=".22"/>
    <path d="M14 86c-6-14 8-30 22-26l16 10c-6 14-22 26-38 16Z" fill="url(#crA)"/>
    <path d="M186 86c6-14-8-30-22-26l-16 10c6 14 22 26 38 16Z" fill="url(#crA)"/>
    <path d="M36 62c4-20 20-32 34-30l12 6c-2 22-14 40-30 44Z" fill="url(#crB)"/>
    <path d="M164 62c-4-20-20-32-34-30l-12 6c2 22 14 40 30 44Z" fill="url(#crB)"/>
    <path d="M70 34c10-14 50-14 60 0 4 18 0 42-30 52-30-10-34-34-30-52Z" fill="url(#crB)"/>
    <g fill="none" stroke="#A85E1E" stroke-width="2.4" stroke-linecap="round" opacity=".55">
      <path d="M78 40c6 14 8 30 4 42"/><path d="M122 40c-6 14-8 30-4 42"/><path d="M100 30v54"/>
      <path d="M48 46c2 12 2 22-2 32"/><path d="M152 46c-2 12-2 22 2 32"/><path d="M26 66c4 6 4 12 0 18"/><path d="M174 66c-4 6-4 12 0 18"/>
    </g>
    <g fill="#fff" opacity=".45"><ellipse cx="96" cy="40" rx="14" ry="4"/><ellipse cx="62" cy="44" rx="8" ry="3"/><ellipse cx="138" cy="44" rx="8" ry="3"/></g>
  </svg>`,
  burger: `<svg viewBox="0 0 170 150" class="w-full h-full">
    <defs>
      <radialGradient id="bun" cx=".45" cy=".25" r=".9"><stop offset="0" stop-color="#F8C27A"/><stop offset=".65" stop-color="#E39A45"/><stop offset="1" stop-color="#BF7128"/></radialGradient>
      <linearGradient id="pat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A3E22"/><stop offset="1" stop-color="#4E2414"/></linearGradient>
    </defs>
    <ellipse cx="85" cy="144" rx="66" ry="6" fill="#000" opacity=".22"/>
    <path d="M20 112h130v8a20 20 0 0 1-20 20H40a20 20 0 0 1-20-20Z" fill="url(#bun)"/>
    <rect x="16" y="94" width="138" height="20" rx="10" fill="url(#pat)"/>
    <path d="M24 98h120" stroke="#9C5A35" stroke-width="2" opacity=".6" stroke-dasharray="6 5"/>
    <path d="M14 90h142l-6 10-8-6-10 9-9-7-10 10-9-8-10 9-9-7-10 9-9-8-10 8-9-6-10 8-6-8Z" fill="#FFC23D"/>
    <path d="M30 84h28l-4 8h-20Z M70 84h30l-4 8h-22Z M112 84h28l-4 8h-20Z" fill="#E2483A"/>
    <path d="M12 82c10-8 18 6 28-2s18 6 28-2 18 6 28-2 18 6 28-2 18 6 26-2v6H12Z" fill="#7BC96F"/>
    <path d="M16 78a69 52 0 0 1 138 0Z" fill="url(#bun)"/>
    <g fill="#FFF6EC"><ellipse cx="54" cy="46" rx="4" ry="2.2" transform="rotate(-20 54 46)"/><ellipse cx="78" cy="36" rx="4" ry="2.2"/><ellipse cx="102" cy="40" rx="4" ry="2.2" transform="rotate(15 102 40)"/><ellipse cx="124" cy="54" rx="4" ry="2.2" transform="rotate(25 124 54)"/><ellipse cx="66" cy="58" rx="4" ry="2.2"/><ellipse cx="94" cy="56" rx="4" ry="2.2" transform="rotate(-10 94 56)"/></g>
    <path d="M44 40c12-12 34-16 52-12" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".35" fill="none"/>
  </svg>`,
  receipt: `<svg viewBox="0 0 100 140" class="w-full h-full">
    <path d="M10 6h80v128l-10-7-10 7-10-7-10 7-10-7-10 7-10-7-10 7V6Z" fill="#fff"/>
    <path d="M10 6h80v8H10Z" fill="#F4F4F2"/>
    <g fill="#17161A" opacity=".2"><rect x="22" y="26" width="56" height="6" rx="3"/><rect x="22" y="44" width="34" height="5" rx="2.5"/><rect x="64" y="44" width="14" height="5" rx="2.5"/><rect x="22" y="58" width="40" height="5" rx="2.5"/><rect x="64" y="58" width="14" height="5" rx="2.5"/><rect x="22" y="72" width="28" height="5" rx="2.5"/><rect x="64" y="72" width="14" height="5" rx="2.5"/></g>
    <path d="M22 86h56" stroke="#17161A" stroke-opacity=".2" stroke-dasharray="3 3"/>
    <rect x="22" y="94" width="56" height="14" rx="4" fill="#FFD84D"/>
  </svg>`,
  donut: `<svg viewBox="0 0 140 120" class="w-full h-full">
    <defs><radialGradient id="dough" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#F6C27F"/><stop offset="1" stop-color="#CF8838"/></radialGradient></defs>
    <ellipse cx="70" cy="112" rx="52" ry="6" fill="#000" opacity=".22"/>
    <ellipse cx="70" cy="66" rx="60" ry="42" fill="url(#dough)"/>
    <path d="M14 60c4-28 30-40 56-40s52 12 56 40c-4 6-10 4-14 10-6-4-12 4-18 0-6 6-12 0-18 4-8-4-12 4-20 0-6 4-12-2-18 2-6-6-12 0-18-6-4 2-6-4-6-10Z" fill="#F7A1B5"/>
    <ellipse cx="70" cy="60" rx="17" ry="11" fill="#7A4A26"/><ellipse cx="70" cy="58" rx="15" ry="9" fill="#FFF6EC"/>
    <g stroke-width="4" stroke-linecap="round"><path d="M34 46l6-4" stroke="#FFD84D"/><path d="M52 34l7 2" stroke="#8FE0BF"/><path d="M90 34l6 4" stroke="#fff"/><path d="M106 48l4 6" stroke="#C9C1FF"/><path d="M40 66l6 2" stroke="#8FE0BF"/><path d="M98 68l6-2" stroke="#FFD84D"/><path d="M76 40l6-2" stroke="#C9C1FF"/></g>
    <path d="M30 42c10-12 30-18 46-16" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".4" fill="none"/>
  </svg>`,
};

// ---------- Alpine components ----------
document.addEventListener('alpine:init', () => {
  // Custom dropdown. Usage: <div x-data="select(['A','B'])" x-modelable="value" x-model="field">
  Alpine.data('select', (options = [], placeholder = 'Select') => ({
    open: false, value: null, options, placeholder,
    label() { const o = this.options.find(o => (o.value ?? o) === this.value); return o ? (o.label ?? o) : this.placeholder; },
    pick(o) { this.value = o.value ?? o; this.open = false; },
  }));

  // Custom calendar. Single date or range. Usage: x-data="datepicker({range:true})" x-modelable="value" x-model="obj"
  Alpine.data('datepicker', (cfg = {}) => ({
    open: false, range: !!cfg.range, value: cfg.range ? { from: '', to: '' } : '',
    view: new Date(2026, 10, 1), hover: null,
    days() {
      const y = this.view.getFullYear(), m = this.view.getMonth(), first = (new Date(y, m, 1).getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
      return [...Array(first).fill(null), ...Array.from({ length: n }, (_, i) => new Date(y, m, i + 1))];
    },
    iso(d) { return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : ''; },
    title() { return this.view.toLocaleString('en-US', { month: 'long', year: 'numeric' }); },
    move(n) { this.view = new Date(this.view.getFullYear(), this.view.getMonth() + n, 1); },
    click(d) {
      const v = this.iso(d);
      if (!this.range) { this.value = v; this.open = false; return; }
      if (!this.value.from || this.value.to) this.value = { from: v, to: '' };
      else if (v < this.value.from) this.value = { from: v, to: this.value.from };
      else { this.value = { from: this.value.from, to: v }; this.open = false; }
    },
    state(d) {
      if (!d) return '';
      const v = this.iso(d);
      if (!this.range) return v === this.value ? 'sel' : '';
      const { from, to } = this.value, end = to || (from && this.hover && this.iso(this.hover) > from ? this.iso(this.hover) : '');
      if (v === from || v === to) return 'sel';
      if (from && end && v > from && v < end) return 'in';
      return '';
    },
    fmt(v) { if (!v) return ''; const d = new Date(v + 'T00:00'); return d.toLocaleString('en-US', { month: 'short', day: 'numeric' }); },
    label() { return this.range ? (this.value.from ? `${this.fmt(this.value.from)} to ${this.value.to ? this.fmt(this.value.to) : '...'}` : 'Pick dates') : (this.value ? this.fmt(this.value) : 'Pick a date'); },
  }));
});
