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

const VERSION = '1.0.2';

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
  ha-card { height:100%; display:flex; flex-direction:column; overflow:hidden; cursor:pointer; -webkit-tap-highlight-color:transparent; }
  .wrap  { flex:1; display:flex; flex-direction:column; justify-content:space-between; box-sizing:border-box; gap:calc(6px*var(--s)); padding:calc(8px*var(--s)); }
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
  }

  static getConfigElement() { return document.createElement('energy-tile-card-editor'); }

  static getStubConfig() {
    return { preset: 'plug', prefix: 'pool_pump', name: 'Pool Pump', icon: 'mdi:pool' };
  }

  setConfig(config) {
    if (!config) throw new Error('energy-tile-card: invalid configuration');
    const cfg = expandConfig(config);
    if (!cfg.value && !cfg.rows && !cfg.panels) {
      throw new Error('energy-tile-card: set a preset, or at least value / rows');
    }
    this._config = cfg;
    const ids = new Set((JSON.stringify(cfg).match(ENTITY_RE) || []));
    (cfg.watch || []).forEach((id) => ids.add(id));
    this._ids = [...ids];
    this._html = null;
    if (this._hass) this._render();
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
    if (it.template != null) raw = this._eval(it.template);
    else {
      const so = this._hass.states[it.entity];
      raw = it.attribute ? so?.attributes?.[it.attribute] : so?.state;
    }
    let color = it.color;
    const unit = it.unit || '';
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
    const d = it.decimals ?? 0;
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
    if (r.above != null && !(v > r.above)) return false;
    if (r.below != null && !(v < r.below)) return false;
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
    let html = `<div class="lbl">${esc(it.label ?? '')}</div>${this._val(it, it.small ? 'val sm' : cls)}`;
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
        + c.panels.map((p) => `<div class="col" style="--s:${(c.scale ?? 1) * factor}">${this._body(p, true)}</div>`).join('')
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
    const html = `<ha-card style="--s:${c.scale ?? 1}"><div class="wrap">${this._body(c, false)}</div></ha-card>`;
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
    this._action(this._config.tap_action || { action: 'more-info' });
  }

  _navigate(path) {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
  }

  _action(a) {
    const hass = this._hass;
    const entity = a.entity || this._config.entity;
    switch (a.action) {
      case 'none':
        return;
      case 'navigate':
        this._navigate(a.navigation_path);
        return;
      case 'toggle': {
        if (!entity) return;
        if (entity.startsWith('water_heater.')) {
          const on = hass.states[entity]?.state !== 'off';
          hass.callService('water_heater', 'set_operation_mode', {
            entity_id: entity, operation_mode: on ? 'off' : (a.on_mode || 'electric'),
          });
        } else {
          hass.callService('homeassistant', 'toggle', { entity_id: entity });
        }
        return;
      }
      case 'perform-action':
      case 'call-service': {
        const [domain, service] = (a.perform_action || a.service || '').split('.');
        if (domain && service) hass.callService(domain, service, a.data || a.service_data || {}, a.target);
        return;
      }
      case 'more-info':
      default:
        if (entity) {
          this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: entity }, bubbles: true, composed: true }));
        }
    }
  }
}

// ---------------------------------------------------------------------------
// Visual editor (preset setup; custom layouts stay in YAML)
// ---------------------------------------------------------------------------
const LABELS = {
  preset: 'Preset', entity: 'Entity', prefix: 'Entity prefix (e.g. pool_pump)', name: 'Name', icon: 'Icon',
  scale: 'Scale', popup: 'Cog button pop-up (e.g. #Bedroom)', water_temp: 'Water temperature sensor',
  target: 'Target temperature entity', count: 'Number of batteries',
  daily: 'Daily energy sensor (optional)', monthly: 'Monthly energy sensor (optional)',
};

function editorSchema(preset) {
  const schema = [
    { name: 'preset', selector: { select: { mode: 'dropdown', options: [
      { value: 'custom', label: 'Custom (YAML)' },
      { value: 'plug', label: 'Smart plug' },
      { value: 'geyser', label: 'Geyser' },
      { value: 'dyness_module', label: 'Dyness battery module' },
      { value: 'golf_cart', label: 'Golf cart batteries' },
    ] } } },
  ];
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
    { name: 'icon', selector: { icon: {} } },
    { name: 'popup', selector: { text: {} } },
    { name: 'scale', selector: { number: { min: 0.5, max: 3, step: 0.1, mode: 'box' } } },
  );
  return schema;
}

class EnergyTileCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
  }

  _render() {
    if (!this._form) {
      this._form = document.createElement('ha-form');
      this._form.computeLabel = (s) => LABELS[s.name] ?? s.name;
      this._form.addEventListener('value-changed', (ev) => {
        const cfg = { ...this._config, ...ev.detail.value };
        Object.keys(cfg).forEach((k) => { if (cfg[k] === '' || cfg[k] == null) delete cfg[k]; });
        if (cfg.preset === 'custom') delete cfg.preset;
        this._config = cfg;
        this._form.schema = editorSchema(cfg.preset);
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: cfg }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = { ...this._config, preset: this._config.preset || 'custom' };
    this._form.schema = editorSchema(this._config.preset);
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
