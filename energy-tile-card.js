/*
 * energy-tile-card
 * One universal tile for power / energy devices: header with status pill,
 * big value, progress bar, rows of stat boxes and a two-value footer.
 *
 * Install via HACS (custom repository: https://github.com/Virmin8/energy-tile-card,
 * category Dashboard), or copy to /config/www/ and add the resource
 *   /local/energy-tile-card.js   (type: JavaScript module)
 *
 * Presets (plug, geyser, dyness_module, golf_cart) fill in the standard
 * layout from an entity prefix; any key you set overrides the preset.
 */

const VERSION = '1.2.0';

// Named status colours: pill [bg, fg] and icon [bg, fg].
const COLORS = {
  idle:   { pill: ['#F1EFE8', '#5F5E5A'], icon: ['#F1EFE8', '#5F5E5A'] },
  off:    { pill: ['#F3F4F6', '#4B5563'], icon: ['#F1EFE8', '#5F5E5A'] },
  green:  { pill: ['#EAF3DE', '#3B6D11'], icon: ['#DCFCE7', '#16A34A'] },
  amber:  { pill: ['#FEF3C7', '#92400E'], icon: ['#FEF3C7', '#D97706'] },
  yellow: { pill: ['#FFFBEB', '#92400E'], icon: ['#FEF3C7', '#D97706'] },
  blue:   { pill: ['#E0F2FE', '#0369A1'], icon: ['#E0F2FE', '#0369A1'] },
  red:    { pill: ['#FEE2E2', '#991B1B'], icon: ['#FEE2E2', '#DC2626'] },
  hot:    { pill: ['#FEF2F2', '#991B1B'], icon: ['#FEE2E2', '#DC2626'] },
};

const CSS = `
  :host { display:block; height:100%; }
  ha-card { overflow:hidden; cursor:pointer; -webkit-tap-highlight-color:transparent; }
  ha-card.fill { height:100%; display:flex; flex-direction:column; }
  .wrap  { display:flex; flex-direction:column; box-sizing:border-box; gap:calc(6px*var(--s)); padding:calc(8px*var(--s)); }
  .fill .wrap { flex:1; justify-content:space-between; }
  .col   { display:flex; flex-direction:column; gap:calc(5px*var(--s)); min-width:0; }
  .row   { display:flex; align-items:center; justify-content:space-between; gap:calc(4px*var(--s)); min-width:0; }
  .hdr   { display:flex; align-items:center; gap:calc(6px*var(--s)); min-width:0; }
  .ico   { width:calc(30px*var(--s)); height:calc(30px*var(--s)); border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background .3s ease; }
  .ico ha-icon { display:flex; --mdc-icon-size:calc(18px*var(--s)); }
  .title { font-size:calc(13px*var(--s)); font-weight:600; color:var(--primary-text-color); }
  .pill  { font-size:calc(10px*var(--s)); font-weight:500; padding:calc(3px*var(--s)) calc(8px*var(--s)); border-radius:calc(20px*var(--s)); white-space:nowrap; flex-shrink:0; }
  .big   { display:flex; align-items:baseline; gap:calc(4px*var(--s)); }
  .big b { font-size:calc(clamp(1.6rem, 6vw, 2.2rem)*var(--s)); font-weight:500; color:var(--primary-text-color); line-height:1; letter-spacing:-1px; }
  .big span { font-size:calc(13px*var(--s)); color:var(--secondary-text-color); }
  .cog   { width:calc(26px*var(--s)); height:calc(26px*var(--s)); border-radius:50%; background:var(--secondary-background-color); color:var(--secondary-text-color); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .cog ha-icon { display:flex; --mdc-icon-size:calc(15px*var(--s)); }
  .bar   { height:calc(5px*var(--s)); background:var(--divider-color); border-radius:calc(3px*var(--s)); overflow:hidden; margin-bottom:calc(3px*var(--s)); }
  .bar > div { height:100%; border-radius:inherit; transition:width .4s ease; }
  .scale { display:flex; justify-content:space-between; gap:4px; font-size:calc(9px*var(--s)); color:var(--disabled-text-color); white-space:nowrap; }
  .grid  { display:grid; gap:calc(5px*var(--s)); }
  .box   { background:var(--secondary-background-color); border-radius:calc(8px*var(--s)); padding:calc(6px*var(--s)) calc(8px*var(--s)); min-width:0; }
  .box.grid { gap:calc(3px*var(--s)); }
  .lbl   { font-size:calc(9px*var(--s)); color:var(--disabled-text-color); margin-bottom:calc(1px*var(--s)); }
  .val   { font-size:calc(13px*var(--s)); font-weight:500; color:var(--primary-text-color); }
  .val.sm { font-size:calc(12px*var(--s)); }
  .val small { font-size:calc(9px*var(--s)); font-weight:normal; color:var(--secondary-text-color); }
  .sub   { font-size:calc(10px*var(--s)); color:var(--secondary-text-color); }
  .sep   { border-left:1px solid var(--divider-color); padding-left:calc(5px*var(--s)); min-width:0; }
  .foot  { display:grid; grid-template-columns:1fr 1fr; border-top:1px solid var(--divider-color); padding-top:calc(6px*var(--s)); margin-top:calc(2px*var(--s)); text-align:center; }
  .title, .lbl, .val, .sub { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
`;

// One stylesheet shared by every card on the page.
let SHEET = null;
function adoptStyles(root) {
  try {
    if (!SHEET) { SHEET = new CSSStyleSheet(); SHEET.replaceSync(CSS); }
    root.adoptedStyleSheets = [SHEET];
  } catch (e) {
    const style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);
  }
}

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ENTITY_RE = /\b(?:sensor|binary_sensor|switch|number|select|water_heater|climate|light|fan|cover|input_number|input_boolean|input_select)\.[a-z0-9_]+/g;

// Expressions in `if:` / `template:` are compiled once and cached.
const FN_CACHE = new Map();
function compile(expr) {
  let fn = FN_CACHE.get(expr);
  if (!fn) {
    fn = new Function('s', 'st', 'attr', 'hass', `"use strict"; return (${expr});`);
    FN_CACHE.set(expr, fn);
  }
  return fn;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------
const today = (entity, decimals = 2, label = '📆 Today') => ({ entity, label, unit: 'kWh', decimals });
const month = (entity, decimals = 2, label = '🗓️ Month') => ({ entity, label, unit: 'kWh', decimals });

const PRESETS = {
  plug(c) {
    const p = c.prefix, d = `${p}_${p}`;
    return {
      entity: `switch.${d}`,
      icon: 'mdi:power-plug',
      status: [{ state: 'on', text: 'Active', color: 'green' }, { text: 'Off', color: 'off' }],
      value: { entity: `sensor.${d}_power`, unit: 'W' },
      bar: { max: 4400, color: '#16A34A', label: 'Load Intensity', left: '0W', right: '4.4kW' },
      rows: [[
        { entity: `sensor.${d}_voltage`, label: '🔌 Volts', unit: 'V' },
        { entity: `sensor.${d}_current`, label: '⚙️ Amps', unit: 'A', decimals: 2 },
      ]],
      footer: [today(c.daily || `sensor.${d}_daily_energy`), month(c.monthly || `sensor.${p}_total_monthly_energy`)],
      tap_action: { action: 'toggle' },
    };
  },

  geyser(c) {
    const p = c.prefix, d = `${p}_${p}`;
    return {
      icon: 'mdi:water-boiler',
      status: [
        { entity: `sensor.${d}_power`, above: 100, text: 'Heating', color: 'hot' },
        { state_not: ['off', 'unknown', 'unavailable'], text: 'On', color: 'yellow' },
        { text: 'Off', color: 'off' },
      ],
      value: { entity: `sensor.${d}_power`, unit: 'W' },
      bar: { max: 5500, color: '#DC2626', label: 'Heating Intensity', left: '0W', right: '5.5kW' },
      rows: [
        [
          { entity: `sensor.${d}_voltage`, label: '🔌 Volts', unit: 'V' },
          { entity: `sensor.${d}_current`, label: '⚙️ Amps', unit: 'A', decimals: 2 },
        ],
        { split: true, items: [
          { entity: c.water_temp, label: '🌡️ Water Temp', unit: '°C' },
          { entity: c.target, label: '🎯 Target Temp', unit: '°C' },
        ] },
      ],
      footer: [today(c.daily || `sensor.${d}_daily_energy`), month(c.monthly || `sensor.${p}_total_monthly_energy`)],
      tap_action: { action: 'toggle' },
    };
  },

  dyness_module(c) {
    const id = (c.entity || '').match(/module_(\d+)_/)?.[1];
    if (!id) throw new Error('dyness_module preset: entity must be sensor.dyness_module_<id>_state_of_charge');
    const e = (k) => `sensor.dyness_module_${id}_${k}`;
    return {
      name: 'Battery',
      icon: 'mdi:battery',
      icon_color: { bg: '#DCFCE7', color: '#15803D' },
      status: batteryStatus(e('current')),
      value: { entity: e('state_of_charge'), unit: '%', decimals: 1 },
      bar: { max: 100, color: '#15803D', label: 'Capacity', left: '0%', right: '100%' },
      rows: [
        [
          { template: `Math.abs(Math.round(s('${e('voltage')}') * s('${e('current')}')))`, label: '⚡ Power', unit: 'W' },
          { template: `s('${e('voltage')}').toFixed(2) + 'V / ' + s('${e('current')}').toFixed(2) + 'A'`, label: '⚙️ Volts / Amps', small: true },
        ],
        cellRow(e('cell_voltage_max'), e('cell_voltage_min'), e('cell_voltage_spread')),
      ],
      tap_action: { action: 'more-info' },
    };
  },

  golf_cart(c) {
    const p = c.prefix || 'golf_cart_battery';
    const count = c.count || 2;
    const panels = [];
    for (let i = 1; i <= count; i++) {
      const e = (k) => `sensor.${p}_${i}_${k}`;
      panels.push({
        name: `Battery ${i}`,
        status: batteryStatus(e('current')),
        value: { entity: e('soc'), unit: '%', decimals: 1 },
        bar: { entity: e('soc'), max: 100, color: '#15803D', left: '0%', right: '100%', label_entity: e('num_cycles'), label_suffix: ' cyc' },
        rows: [
          [
            { entity: e('power'), label: '⚡ Power', unit: 'W', abs: true },
            { entity: e('voltage'), label: '⚙️ Volt', unit: 'V', decimals: 2 },
            { entity: e('current'), label: '🔌 Amp', unit: 'A', decimals: 2 },
          ],
          [
            { entity: e('cell_volt_max'), label: '📈 Max', unit: 'V', decimals: 3 },
            { entity: e('cell_volt_min'), label: '📉 Min', unit: 'V', decimals: 3 },
            { entity: e('cell_volt_delta'), label: '⚖️ Δ', unit: 'mV', multiply: 1000 },
          ],
        ],
        footer: [today(e('charge_daily'), 2, '📥 In'), today(e('discharge_daily'), 2, '📤 Out')],
      });
    }
    return {
      entity: `sensor.${p}_1_soc`,
      name: 'Golf Batteries',
      icon: 'mdi:battery-charging',
      icon_color: { bg: '#DCFCE7', color: '#15803D' },
      auto_base: 333,
      panels,
      tap_action: { action: 'more-info' },
    };
  },
};

function batteryStatus(current) {
  return [
    { entity: current, above: 0.1, text: 'Charging', color: 'green' },
    { entity: current, below: -0.1, text: 'Discharging', color: 'red' },
    { text: 'Idle', color: 'idle' },
  ];
}

function cellRow(max, min, spread) {
  return [
    { entity: max, label: '📈 Max', unit: 'V', decimals: 3 },
    { entity: min, label: '📉 Min', unit: 'V', decimals: 3 },
    { entity: spread, label: '⚖️ Delta', unit: 'mV' },
  ];
}

function expandConfig(config) {
  const preset = config.preset && config.preset !== 'custom' ? config.preset : null;
  if (!preset) return { ...config };
  const make = PRESETS[preset];
  if (!make) throw new Error(`energy-tile-card: unknown preset "${preset}"`);
  if ((preset === 'plug' || preset === 'geyser') && !config.prefix) {
    throw new Error(`energy-tile-card: preset "${preset}" needs a prefix`);
  }
  if (preset === 'geyser' && !config.entity) {
    throw new Error('energy-tile-card: preset "geyser" needs the water_heater entity');
  }
  return { ...make(config), ...config };
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
class EnergyTileCard extends HTMLElement {
  constructor() {
    super();
    this._root = this.attachShadow({ mode: 'open' });
    adoptStyles(this._root);
    this._content = document.createElement('div');
    this._content.style.height = '100%';
    this._root.appendChild(this._content);
    this._root.addEventListener('click', (ev) => this._onClick(ev));
    // hold_action: fire after 500 ms; the click that follows is swallowed.
    this.addEventListener('pointerdown', (ev) => {
      this._held = false;
      clearTimeout(this._holdTimer);
      if (!this._config?.hold_action || ev.composedPath().some((el) => el.dataset?.popup)) return;
      this._holdTimer = setTimeout(() => { this._held = true; this._action('hold'); }, 500);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) =>
      this.addEventListener(t, () => clearTimeout(this._holdTimer)));
  }

  static getConfigElement() { return document.createElement('energy-tile-card-editor'); }

  static getStubConfig(hass) {
    const states = hass?.states || {};
    const power = Object.keys(states).find((id) => id.startsWith('sensor.') && states[id].attributes?.device_class === 'power') || '';
    return {
      name: 'Device',
      icon: 'mdi:flash',
      entity: power,
      status: [{ above: 5, text: 'On', color: 'green' }, { text: 'Idle', color: 'idle' }],
      value: { entity: power },
      bar: { max: 3000, color: '#16A34A', left: '0', label: '{pct}%', right: '3 kW' },
    };
  }

  setConfig(config) {
    if (!config) throw new Error('energy-tile-card: invalid configuration');
    const cfg = expandConfig(config);
    this._config = cfg;
    const ids = new Set((JSON.stringify(cfg).match(ENTITY_RE) || []));
    (cfg.watch || []).forEach((id) => ids.add(id));
    this._ids = [...ids];
    this._html = null;
    this._observeSize();
    if (this._hass) this._render();
  }

  connectedCallback() { this._observeSize(); }

  disconnectedCallback() {
    this._ro?.disconnect();
    this._ro = null;
  }

  // scale: auto -> derive the scale from the tile's width, so one config fits
  // both a wall tablet and a desktop screen.
  _observeSize() {
    if (this._config?.scale !== 'auto' || this._ro || !this.isConnected || !window.ResizeObserver) return;
    this._ro = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      if (!width) return;
      const c = this._config;
      const raw = width / (c.auto_base ?? 250);
      const scale = Math.round(Math.min(Math.max(raw, c.auto_min ?? 0.7), c.auto_max ?? 2) * 20) / 20;
      if (scale === this._autoScale) return;
      this._autoScale = scale;
      this._html = null;
      this._schedule();
    });
    this._ro.observe(this);
  }

  _scale() {
    const c = this._config;
    if (c.scale === 'auto') return this._autoScale ?? 1;
    const v = parseFloat(c.scale);
    return Number.isFinite(v) ? v : 1;
  }

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    if (!this._config) return;
    // Only redraw when one of this card's own entities changed.
    if (!old || this._ids.some((id) => old.states[id] !== hass.states[id])) this._schedule();
  }

  getCardSize() { return this._config?.panels ? 7 : 6; }

  getGridOptions() { return { columns: 6, min_columns: 3 }; }

  // Coalesce bursts of state changes into one paint.
  _schedule() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = null; this._render(); });
  }

  // -- value helpers ------------------------------------------------------
  _eval(expr) {
    const h = this._hass;
    const s = (id) => { const v = parseFloat(h.states[id]?.state); return Number.isFinite(v) ? v : 0; };
    const st = (id) => h.states[id]?.state;
    const attr = (id, a) => h.states[id]?.attributes?.[a];
    try { return compile(expr)(s, st, attr, h); } catch (e) {
      console.warn('energy-tile-card: expression failed', expr, e);
      return null;
    }
  }

  _item(it) {
    let raw;
    const so = it.entity ? this._hass.states[it.entity] : null;
    if (it.template != null) raw = this._eval(it.template);
    else raw = it.attribute ? so?.attributes?.[it.attribute] : so?.state;
    let color = it.color;
    // Unit defaults to the entity's own unit (not for text, templates or attributes).
    const unit = it.unit ?? (it.text || it.template != null || it.attribute ? '' : so?.attributes?.unit_of_measurement ?? '');
    const missing = raw == null || raw === 'unavailable' || raw === 'unknown' || raw === '';

    if (it.map) {
      const m = it.map[raw] ?? it.map['*'];
      if (m != null && typeof m === 'object') { raw = m.text; color = m.color ?? color; } else if (m != null) raw = m;
      return { text: raw == null ? '—' : String(raw), unit: '', color };
    }
    if (missing) return { text: '—', unit: '', color };
    if (it.text || (typeof raw === 'string' && it.template != null)) return { text: String(raw), unit, color };

    let v = typeof raw === 'number' ? raw : parseFloat(raw);
    if (!Number.isFinite(v)) return { text: '—', unit: '', color };
    if (it.multiply != null) v *= it.multiply;
    if (it.abs) v = Math.abs(v);
    // Decimals: explicit, else the entity's display precision, else a sensible guess.
    const d = it.decimals
      ?? this._hass.entities?.[it.entity]?.display_precision
      ?? (Number.isInteger(v) || Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2);
    const text = it.locale
      ? v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })
      : v.toFixed(d);
    return { text, unit, color, num: v };
  }

  _num(id) {
    const v = parseFloat(this._hass.states[id]?.state);
    return Number.isFinite(v) ? v : 0;
  }

  _status(rules, defEntity) {
    for (const r of rules || []) {
      if (!this._match(r, defEntity)) continue;
      const c = COLORS[r.color] || { pill: [r.color || COLORS.idle.pill[0], r.text_color || '#FFFFFF'], icon: [r.color, r.text_color || '#FFFFFF'] };
      return { text: r.text ?? '', c };
    }
    return null;
  }

  _match(r, defEntity) {
    if (r.if != null && !this._eval(r.if)) return false;
    const st = this._hass.states[r.entity || defEntity]?.state;
    if (r.state != null && ![].concat(r.state).map(String).includes(st)) return false;
    if (r.state_not != null && [].concat(r.state_not).map(String).includes(st)) return false;
    const v = parseFloat(st);
    if (r.above != null && r.above !== '' && !(v > Number(r.above))) return false;
    if (r.below != null && r.below !== '' && !(v < Number(r.below))) return false;
    return true;
  }

  // -- html pieces --------------------------------------------------------
  _val(it, cls) {
    const r = this._item(it);
    const style = (r.color ? `color:${r.color};` : '') + (it.capitalize ? 'text-transform:capitalize;' : '');
    const unit = r.unit && r.text !== '—' ? `<small> ${esc(r.unit)}</small>` : '';
    return `<div class="${cls}"${style ? ` style="${style}"` : ''}>${esc(r.text)}${unit}</div>`;
  }

  _cell(it, cls) {
    const label = it.label ?? (it.entity ? this._hass.states[it.entity]?.attributes?.friendly_name : '') ?? '';
    let html = `<div class="lbl">${esc(label)}</div>${this._val(it, it.small ? 'val sm' : cls)}`;
    if (it.sub) {
      const parts = it.sub.map((x) => { const r = this._item(x); return r.text === '—' ? '—' : `${r.text}${r.unit}`; });
      html += `<div class="sub">${esc(parts.join(' '))}</div>`;
    }
    return html;
  }

  _rows(rows) {
    return (rows || []).map((row) => {
      const items = Array.isArray(row) ? row : row.items || [];
      const split = Array.isArray(row) ? items.length >= 3 : (row.split ?? items.length >= 3);
      const cols = `grid-template-columns:repeat(${items.length},1fr)`;
      if (split) {
        return `<div class="box grid" style="${cols}">${items.map((it, i) =>
          `<div class="${i ? 'sep' : ''}" style="min-width:0">${this._cell(it, 'val sm')}</div>`).join('')}</div>`;
      }
      return `<div class="grid" style="${cols}">${items.map((it) =>
        `<div class="box">${this._cell(it, 'val')}</div>`).join('')}</div>`;
    }).join('');
  }

  _bar(c) {
    const b = c.bar;
    const v = b.template != null ? Number(this._eval(b.template)) || 0 : this._num(b.entity || c.value?.entity);
    const max = b.max ?? 100;
    const pct = Math.round(Math.min(Math.max((v / max) * 100, 0), 100));
    let label = String(b.label ?? '').replace('{pct}', pct);
    if (b.label_entity) {
      const r = this._item({ entity: b.label_entity, decimals: b.label_decimals ?? 0 });
      label = `${r.text}${b.label_suffix ?? ''}`;
    }
    return `<div><div class="bar"><div style="width:${pct}%;background:${b.color || 'var(--primary-color)'}"></div></div>`
      + `<div class="scale"><span>${esc(b.left ?? '0')}</span><span>${esc(label)}</span><span>${esc(b.right ?? max)}</span></div></div>`;
  }

  _pill(st) {
    return st ? `<span class="pill" style="background:${st.c.pill[0]};color:${st.c.pill[1]}">${esc(st.text)}</span>` : '';
  }

  _body(c, panel) {
    const st = this._status(c.status, c.entity);
    let h = '';

    if (panel) {
      h += `<div class="row"><span class="title">${esc(c.name ?? '')}</span>${this._pill(st)}</div>`;
    } else {
      const ic = c.icon_color
        || (st ? { bg: st.c.icon[0], color: st.c.icon[1] } : { bg: 'var(--secondary-background-color)', color: 'var(--primary-text-color)' });
      h += `<div class="row"><div class="hdr">`
        + `<div class="ico" style="background:${ic.bg}"><ha-icon icon="${esc(c.icon || 'mdi:flash')}" style="color:${ic.color}"></ha-icon></div>`
        + `<span class="title">${esc(c.name ?? '')}</span></div>${this._pill(st)}</div>`;
    }

    if (c.value) {
      const r = this._item(c.value);
      const big = `<div class="big"><b>${esc(r.text)}</b><span>${esc(r.unit)}</span></div>`;
      h += c.popup && !panel
        ? `<div class="row">${big}<div class="cog" data-popup="${esc(c.popup)}"><ha-icon icon="mdi:cog"></ha-icon></div></div>`
        : big;
    }

    if (c.bar) h += this._bar(c);

    if (c.panels) {
      const factor = c.panel_scale ?? 0.8;
      h += `<div class="grid" style="grid-template-columns:repeat(${c.panels.length},1fr);gap:calc(10px*var(--s))">`
        + c.panels.map((p) => `<div class="col" style="--s:${this._scale() * factor}">${this._body(p, true)}</div>`).join('')
        + `</div>`;
    }

    h += this._rows(c.rows);

    if (c.footer?.length) {
      h += `<div class="foot">${c.footer.map((it, i) =>
        `<div class="${i ? 'sep' : ''}">${this._cell(it, 'val')}</div>`).join('')}</div>`;
    }
    return h;
  }

  _render() {
    if (!this._config || !this._hass) return;
    const c = this._config;
    const html = `<ha-card class="${c.fill ? 'fill' : ''}" style="--s:${this._scale()}"><div class="wrap">${this._body(c, false)}</div></ha-card>`;
    if (html === this._html) return; // nothing visible changed
    this._html = html;
    this._content.innerHTML = html;
  }

  // -- actions ------------------------------------------------------------
  _onClick(ev) {
    const cog = ev.composedPath().find((el) => el.dataset?.popup);
    if (cog) {
      ev.stopPropagation();
      this._navigate(cog.dataset.popup);
      return;
    }
    if (this._held) { this._held = false; return; }
    this._action('tap');
  }

  _navigate(path) {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
  }

  // kind: 'tap' | 'hold'. Uses Home Assistant's own action handler, so every
  // standard action works (more-info, toggle, perform-action, navigate, url, ...).
  _action(kind) {
    const c = this._config;
    const a = c[`${kind}_action`] || (kind === 'tap' ? { action: 'more-info' } : null);
    if (!a || a.action === 'none') return;
    const entity = a.entity || c.entity;
    // Water heaters have no on/off toggle; switch between a mode and off.
    if (a.action === 'toggle' && entity?.startsWith('water_heater.')) {
      const on = this._hass.states[entity]?.state !== 'off';
      this._hass.callService('water_heater', 'set_operation_mode', {
        entity_id: entity, operation_mode: on ? 'off' : (a.on_mode || 'electric'),
      });
      return;
    }
    this.dispatchEvent(new CustomEvent('hass-action', {
      bubbles: true,
      composed: true,
      detail: { config: { entity, [`${kind}_action`]: a }, action: kind },
    }));
  }
}

// ---------------------------------------------------------------------------
// Visual editor: every part of the tile can be built in the UI.
// Expressions (if / template), sub-lines, value maps and panels are YAML-only
// and are kept untouched when you edit other fields.
// ---------------------------------------------------------------------------
const LABELS = {
  name: 'Name', entity: 'Entity', icon: 'Icon', scale: 'Scale (number or auto)', popup: 'Cog button opens (e.g. #popup or /lovelace/1)',
  fill: 'Stretch to row height', icon_bg: 'Icon background (CSS colour, empty = status colour)', icon_fg: 'Icon colour',
  label: 'Label', unit: 'Unit (empty = from entity)', decimals: 'Decimals', multiply: 'Multiply by', abs: 'Absolute value',
  text: 'Show as text', locale: 'Thousands separator', small: 'Smaller text',
  condition: 'Condition', value: 'Value', color: 'Colour',
  max: 'Maximum', left: 'Left text', right: 'Right text',
  tap_action: 'Tap action', hold_action: 'Hold action', split: 'One box with dividers (automatic for 3+ items)',
  preset: 'Preset', prefix: 'Entity prefix', water_temp: 'Water temperature sensor', target: 'Target temperature entity',
  count: 'Number of batteries', daily: 'Daily energy sensor (optional)', monthly: 'Monthly energy sensor (optional)',
};

const HELPERS = {
  label: 'Empty = entity name',
  scale: '1 = normal size. auto sizes the tile from its width.',
  popup: 'Shows a cog button next to the main value.',
};

const grid = (...schema) => ({ type: 'grid', name: '', schema });

const GENERAL_SCHEMA = [
  { name: 'name', selector: { text: {} } },
  { name: 'entity', selector: { entity: {} } },
  grid({ name: 'icon', selector: { icon: {} } }, { name: 'scale', selector: { text: {} } }),
  grid({ name: 'icon_bg', selector: { text: {} } }, { name: 'icon_fg', selector: { text: {} } }),
  { name: 'popup', selector: { text: {} } },
  { name: 'fill', selector: { boolean: {} } },
];

const ITEM_SCHEMA = [
  { name: 'entity', selector: { entity: {} } },
  grid({ name: 'label', selector: { text: {} } }, { name: 'unit', selector: { text: {} } }),
  grid(
    { name: 'decimals', selector: { number: { min: 0, max: 4, mode: 'box' } } },
    { name: 'multiply', selector: { number: { step: 'any', mode: 'box' } } },
  ),
  grid({ name: 'abs', selector: { boolean: {} } }, { name: 'text', selector: { boolean: {} } }),
];

const VALUE_SCHEMA = [
  { name: 'entity', selector: { entity: {} } },
  grid({ name: 'unit', selector: { text: {} } }, { name: 'decimals', selector: { number: { min: 0, max: 4, mode: 'box' } } }),
  grid({ name: 'abs', selector: { boolean: {} } }, { name: 'locale', selector: { boolean: {} } }),
];

const RULE_SCHEMA = [
  grid(
    { name: 'condition', selector: { select: { mode: 'dropdown', options: [
      { value: 'always', label: 'Always (fallback)' },
      { value: 'above', label: 'Number above' },
      { value: 'below', label: 'Number below' },
      { value: 'equals', label: 'State is' },
      { value: 'not', label: 'State is not' },
    ] } } },
    { name: 'value', selector: { text: {} } },
  ),
  { name: 'entity', selector: { entity: {} } },
  grid(
    { name: 'text', selector: { text: {} } },
    { name: 'color', selector: { select: { mode: 'dropdown', custom_value: true, options: Object.keys(COLORS) } } },
  ),
];

const BAR_SCHEMA = [
  { name: 'entity', selector: { entity: {} } },
  grid({ name: 'max', selector: { number: { step: 'any', mode: 'box' } } }, { name: 'color', selector: { text: {} } }),
  grid({ name: 'left', selector: { text: {} } }, { name: 'label', selector: { text: {} } }, { name: 'right', selector: { text: {} } }),
];

const ACTION_SCHEMA = [
  { name: 'tap_action', selector: { ui_action: {} } },
  { name: 'hold_action', selector: { ui_action: {} } },
];

function presetSchema(preset) {
  const schema = [];
  if (preset === 'geyser') schema.push({ name: 'entity', selector: { entity: { domain: 'water_heater' } } });
  if (preset === 'dyness_module') schema.push({ name: 'entity', selector: { entity: { domain: 'sensor' } } });
  if (['plug', 'geyser', 'golf_cart'].includes(preset)) schema.push({ name: 'prefix', selector: { text: {} } });
  if (preset === 'geyser') {
    schema.push({ name: 'water_temp', selector: { entity: { domain: 'sensor' } } });
    schema.push({ name: 'target', selector: { entity: {} } });
  }
  if (preset === 'golf_cart') schema.push({ name: 'count', selector: { number: { min: 1, max: 4, mode: 'box' } } });
  if (preset === 'plug' || preset === 'geyser') {
    schema.push({ name: 'daily', selector: { entity: { domain: 'sensor' } } });
    schema.push({ name: 'monthly', selector: { entity: { domain: 'sensor' } } });
  }
  schema.push(
    { name: 'name', selector: { text: {} } },
    grid({ name: 'icon', selector: { icon: {} } }, { name: 'scale', selector: { text: {} } }),
    { name: 'popup', selector: { text: {} } },
  );
  return schema;
}

const clone = (o) => JSON.parse(JSON.stringify(o ?? null));

// Drop empty strings / null / undefined so the YAML stays tidy.
function tidy(obj) {
  const out = {};
  Object.entries(obj).forEach(([k, v]) => { if (v !== '' && v != null && v !== false) out[k] = v; });
  return out;
}

function ruleToForm(r) {
  const condition = r.above != null ? 'above' : r.below != null ? 'below' : r.state != null ? 'equals' : r.state_not != null ? 'not' : 'always';
  const raw = r.above ?? r.below ?? r.state ?? r.state_not;
  return { condition, value: raw == null ? '' : [].concat(raw).join(', '), entity: r.entity, text: r.text, color: r.color };
}

function formToRule(f) {
  const r = tidy({ entity: f.entity, text: f.text, color: f.color });
  const v = (f.value ?? '').toString().trim();
  const list = v.split(',').map((x) => x.trim()).filter(Boolean);
  if (f.condition === 'above' && v !== '') r.above = Number(v);
  if (f.condition === 'below' && v !== '') r.below = Number(v);
  if (f.condition === 'equals' && list.length) r.state = list.length === 1 ? list[0] : list;
  if (f.condition === 'not' && list.length) r.state_not = list.length === 1 ? list[0] : list;
  return r;
}

// A rule the form can't represent (expression or several conditions) stays YAML-only.
const ruleIsAdvanced = (r) => r.if != null || ['above', 'below', 'state', 'state_not'].filter((k) => r[k] != null).length > 1;

const EDITOR_CSS = `
  .ed { display:flex; flex-direction:column; gap:12px; }
  ha-expansion-panel { display:block; }
  .body { display:flex; flex-direction:column; gap:12px; padding:8px 0 12px; }
  .entry { border:1px solid var(--divider-color); border-radius:8px; padding:8px 10px; display:flex; flex-direction:column; gap:8px; }
  .entry.row { background:rgba(127,127,127,0.04); }
  .entry-head { display:flex; align-items:center; gap:6px; font-weight:500; font-size:14px; }
  .entry-head .grow { flex:1; }
  .note { font-size:12px; color:var(--secondary-text-color); }
  .btn { font:inherit; font-size:13px; padding:6px 12px; border-radius:6px; cursor:pointer;
         border:1px solid var(--divider-color); background:var(--card-background-color, transparent); color:var(--primary-color); }
  .btn.icon { padding:2px 8px; color:var(--secondary-text-color); }
  .btn.danger { color:var(--error-color, #db4437); }
  .btn.primary { background:var(--primary-color); color:var(--text-primary-color, #fff); border-color:var(--primary-color); }
  .actions { display:flex; gap:8px; flex-wrap:wrap; }
`;

class EnergyTileCardEditor extends HTMLElement {
  constructor() {
    super();
    this._open = new Set(['general']);
    this._forms = [];
  }

  setConfig(config) {
    // Our own change coming back: keep the DOM (and keyboard focus) and the
    // config object the open forms are editing.
    if (this._emitted && JSON.stringify(config) === this._emitted) return;
    this._config = clone(config);
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._forms.forEach((f) => { f.hass = hass; });
  }

  // -- plumbing -------------------------------------------------------------
  _emit(rerender = false) {
    this._emitted = JSON.stringify(this._config);
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: clone(this._config) }, bubbles: true, composed: true }));
    if (rerender) this._render();
  }

  _form(schema, data, onChange) {
    const f = document.createElement('ha-form');
    f.hass = this._hass;
    f.schema = schema;
    f.data = data;
    f.computeLabel = (s) => LABELS[s.name] ?? s.name;
    f.computeHelper = (s) => HELPERS[s.name];
    f.addEventListener('value-changed', (ev) => { ev.stopPropagation(); f.data = ev.detail.value; onChange(ev.detail.value); });
    this._forms.push(f);
    return f;
  }

  _btn(text, onClick, cls = '') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn ${cls}`;
    b.textContent = text;
    b.addEventListener('click', (ev) => { ev.stopPropagation(); onClick(); });
    return b;
  }

  _el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  _panel(key, title, children) {
    const p = document.createElement('ha-expansion-panel');
    p.header = title;
    p.outlined = true;
    p.expanded = this._open.has(key);
    p.addEventListener('expanded-changed', (ev) => {
      if (ev.detail.expanded) this._open.add(key); else this._open.delete(key);
    });
    const body = this._el('div', 'body');
    children.filter(Boolean).forEach((c) => body.append(c));
    p.append(body);
    return p;
  }

  // Header for a list entry: title + move up/down + delete.
  _entryHead(title, list, index, rerender) {
    const head = this._el('div', 'entry-head');
    head.append(this._el('span', 'grow', title));
    if (index > 0) head.append(this._btn('↑', () => { [list[index - 1], list[index]] = [list[index], list[index - 1]]; this._emit(true); }, 'icon'));
    if (index < list.length - 1) head.append(this._btn('↓', () => { [list[index + 1], list[index]] = [list[index], list[index + 1]]; this._emit(true); }, 'icon'));
    head.append(this._btn('✕', () => { list.splice(index, 1); rerender(); }, 'icon danger'));
    return head;
  }

  // -- sections -------------------------------------------------------------
  _itemEntry(list, index, title) {
    const it = list[index];
    const entry = this._el('div', 'entry');
    entry.append(this._entryHead(title, list, index, () => this._emit(true)));
    const form = this._form(ITEM_SCHEMA, it, (v) => {
      const cur = list[index];
      const keep = {};
      ['template', 'sub', 'map', 'attribute', 'color', 'capitalize', 'small', 'locale'].forEach((k) => { if (cur[k] != null) keep[k] = cur[k]; });
      list[index] = { ...tidy(v), ...keep };
      this._emit();
    });
    entry.append(form);
    if (it.template != null || it.sub || it.map) entry.append(this._el('div', 'note', 'Has YAML-only options (template / sub / map); they are kept.'));
    return entry;
  }

  _statusSection(c) {
    c.status = c.status || [];
    const list = c.status;
    const els = [this._el('div', 'note', 'Rules are checked top to bottom; the first one that matches sets the pill text and colour. "Entity" defaults to the card entity.')];
    list.forEach((r, i) => {
      const entry = this._el('div', 'entry');
      entry.append(this._entryHead(`Rule ${i + 1}`, list, i, () => this._emit(true)));
      if (ruleIsAdvanced(r)) {
        entry.append(this._el('div', 'note', `Advanced rule (edit in YAML): ${r.if ?? JSON.stringify(r)}`));
      } else {
        entry.append(this._form(RULE_SCHEMA, ruleToForm(r), (v) => { list[i] = formToRule(v); this._emit(); }));
      }
      els.push(entry);
    });
    els.push(this._el('div', 'actions'));
    els[els.length - 1].append(this._btn('+ Add rule', () => {
      list.push({ text: 'On', color: 'green' });
      this._open.add('status');
      this._emit(true);
    }));
    return this._panel('status', 'Status pill', els);
  }

  _valueSection(c) {
    const els = [];
    if (c.value) {
      els.push(this._form(VALUE_SCHEMA, c.value, (v) => {
        const keep = {};
        ['template', 'map', 'attribute', 'color', 'multiply', 'text'].forEach((k) => { if (c.value[k] != null) keep[k] = c.value[k]; });
        c.value = { ...tidy(v), ...keep };
        this._emit();
      }));
      els.push(this._el('div', 'actions'));
      els[els.length - 1].append(this._btn('Remove main value', () => { delete c.value; this._emit(true); }, 'danger'));
    } else {
      els.push(this._el('div', 'actions'));
      els[0].append(this._btn('+ Add main value', () => { c.value = { entity: c.entity || '' }; this._open.add('value'); this._emit(true); }));
    }
    return this._panel('value', 'Main value', els);
  }

  _barSection(c) {
    const els = [];
    if (c.bar) {
      els.push(this._el('div', 'note', 'Entity defaults to the main value. Use {pct} in the label for the percentage.'));
      els.push(this._form(BAR_SCHEMA, c.bar, (v) => {
        const keep = {};
        ['template', 'label_entity', 'label_suffix', 'label_decimals'].forEach((k) => { if (c.bar[k] != null) keep[k] = c.bar[k]; });
        c.bar = { ...tidy(v), ...keep };
        this._emit();
      }));
      els.push(this._el('div', 'actions'));
      els[els.length - 1].append(this._btn('Remove bar', () => { delete c.bar; this._emit(true); }, 'danger'));
    } else {
      els.push(this._el('div', 'actions'));
      els[0].append(this._btn('+ Add bar', () => {
        c.bar = { max: 100, color: '#16A34A', left: '0', label: '{pct}%', right: '100' };
        this._open.add('bar');
        this._emit(true);
      }));
    }
    return this._panel('bar', 'Progress bar', els);
  }

  _rowsSection(c) {
    c.rows = c.rows || [];
    const rows = c.rows;
    const els = [this._el('div', 'note', 'Each row shows its items side by side. 2 items = separate boxes; 3 or more = one box with dividers.')];
    rows.forEach((row, ri) => {
      const isObj = !Array.isArray(row);
      const items = isObj ? (row.items = row.items || []) : row;
      const box = this._el('div', 'entry row');
      box.append(this._entryHead(`Row ${ri + 1}`, rows, ri, () => this._emit(true)));
      box.append(this._form([{ name: 'split', selector: { boolean: {} } }], { split: isObj && !!row.split }, (v) => {
        rows[ri] = v.split ? { split: true, items } : items;
        this._emit();
      }));
      items.forEach((_, ii) => box.append(this._itemEntry(items, ii, `Item ${ii + 1}`)));
      const act = this._el('div', 'actions');
      act.append(this._btn('+ Add item', () => { items.push({ entity: '' }); this._emit(true); }));
      box.append(act);
      els.push(box);
    });
    const act = this._el('div', 'actions');
    act.append(this._btn('+ Add row', () => { rows.push([{ entity: '' }, { entity: '' }]); this._open.add('rows'); this._emit(true); }));
    els.push(act);
    return this._panel('rows', 'Stat rows', els);
  }

  _footerSection(c) {
    c.footer = c.footer || [];
    const list = c.footer;
    const els = [this._el('div', 'note', 'Shown under a divider at the bottom, usually Today / Month.')];
    list.forEach((_, i) => els.push(this._itemEntry(list, i, `Footer item ${i + 1}`)));
    const act = this._el('div', 'actions');
    act.append(this._btn('+ Add footer item', () => { list.push({ entity: '' }); this._open.add('footer'); this._emit(true); }));
    els.push(act);
    return this._panel('footer', 'Footer', els);
  }

  _generalSection(c) {
    const data = { ...c, icon_bg: c.icon_color?.bg, icon_fg: c.icon_color?.color, scale: c.scale != null ? String(c.scale) : undefined };
    const form = this._form(GENERAL_SCHEMA, data, (v) => {
      const next = tidy(v);
      ['name', 'entity', 'icon', 'popup', 'fill'].forEach((k) => { if (next[k] != null && next[k] !== false) c[k] = next[k]; else delete c[k]; });
      if (next.scale != null) c.scale = next.scale === 'auto' || Number.isNaN(Number(next.scale)) ? next.scale : Number(next.scale); else delete c.scale;
      if (next.icon_bg || next.icon_fg) c.icon_color = tidy({ bg: next.icon_bg, color: next.icon_fg }); else delete c.icon_color;
      this._emit();
    });
    return this._panel('general', 'General', [form]);
  }

  _actionsSection(c) {
    const form = this._form(ACTION_SCHEMA, { tap_action: c.tap_action, hold_action: c.hold_action }, (v) => {
      ['tap_action', 'hold_action'].forEach((k) => { if (v[k]) c[k] = v[k]; else delete c[k]; });
      this._emit();
    });
    return this._panel('actions', 'Tap & hold actions', [form]);
  }

  _presetSection(c) {
    const els = [
      this._el('div', 'note', `This card uses the "${c.preset}" preset, which fills in the layout from an entity naming pattern.`),
      this._form(presetSchema(c.preset), { ...c, scale: c.scale != null ? String(c.scale) : undefined }, (v) => {
        const next = tidy(v);
        if (next.scale != null && next.scale !== 'auto' && !Number.isNaN(Number(next.scale))) next.scale = Number(next.scale);
        this._config = { type: c.type, preset: c.preset, ...next };
        this._emit();
      }),
    ];
    if (c.preset !== 'golf_cart') {
      const act = this._el('div', 'actions');
      act.append(this._btn('Convert to fully editable card', () => {
        const full = expandConfig(c);
        ['preset', 'prefix', 'water_temp', 'target', 'daily', 'monthly', 'count'].forEach((k) => delete full[k]);
        this._config = { type: c.type, ...full };
        this._open = new Set(['general']);
        this._emit(true);
      }, 'primary'));
      els.push(act);
    } else {
      els.push(this._el('div', 'note', 'Side-by-side panels are edited in YAML.'));
    }
    return this._panel('preset', 'Preset', els);
  }

  _render() {
    if (!this._config) return;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = EDITOR_CSS;
      this.shadowRoot.append(style);
    }
    this._forms = [];
    this.shadowRoot.querySelector('.ed')?.remove();
    const root = this._el('div', 'ed');
    const c = this._config;
    if (c.preset) {
      this._open.add('preset');
      root.append(this._presetSection(c));
      root.append(this._actionsSection(c));
    } else {
      root.append(
        this._generalSection(c),
        this._statusSection(c),
        this._valueSection(c),
        this._barSection(c),
        this._rowsSection(c),
        this._footerSection(c),
        this._actionsSection(c),
      );
      if (c.panels) root.append(this._el('div', 'note', 'This card has side-by-side panels; edit those in YAML.'));
    }
    this.shadowRoot.append(root);
  }
}

if (!customElements.get('energy-tile-card')) customElements.define('energy-tile-card', EnergyTileCard);
if (!customElements.get('energy-tile-card-editor')) customElements.define('energy-tile-card-editor', EnergyTileCardEditor);

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === 'energy-tile-card')) {
  window.customCards.push({
    type: 'energy-tile-card',
    name: 'Energy Tile Card',
    description: 'Power / energy tile with status pill, bar, stat boxes and daily / monthly totals.',
    preview: true,
  });
}

console.info(`%c ENERGY-TILE-CARD %c v${VERSION} `, 'background:#15803D;color:#fff;font-weight:600', 'background:#DCFCE7;color:#15803D');
