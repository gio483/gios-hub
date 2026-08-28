/**
 * Keylight - control primitives.
 *
 * Every interactive element is at least 44px on its shortest side and works
 * from a single tap. Nothing depends on hover, and nothing depends on a
 * cursor being able to sit still on a two pixel target.
 */

export function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/**
 * A control over a fixed ladder of values: apertures, shutter speeds, ISO,
 * flash power. Steps with the buttons, scrubs with a drag, and always lands
 * on a real setting rather than somewhere between two.
 */
export function ladderControl({ label, values, format, get, set, sub, accent }) {
  const root = el('div', 'ctl ladder');
  if (accent) root.dataset.accent = accent;
  const head = el('div', 'ctl-head');
  head.append(el('span', 'ctl-label', label));
  const subEl = el('span', 'ctl-sub');
  head.append(subEl);
  root.append(head);

  const row = el('div', 'ctl-row');
  const minus = el('button', 'ctl-btn', '−');
  const plus = el('button', 'ctl-btn', '+');
  const track = el('div', 'ctl-track');
  const value = el('div', 'ctl-value');
  const ticks = el('div', 'ctl-ticks');
  track.append(ticks, value);
  minus.setAttribute('aria-label', `${label} down`);
  plus.setAttribute('aria-label', `${label} up`);
  row.append(minus, track, plus);
  root.append(row);

  const idx = () => {
    const v = get();
    let best = 0, bd = Infinity;
    for (let i = 0; i < values.length; i++) {
      const d = Math.abs(Math.log2(values[i] / v));
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };
  const apply = (i) => set(values[Math.max(0, Math.min(values.length - 1, i))]);

  minus.onclick = () => apply(idx() - 1);
  plus.onclick = () => apply(idx() + 1);

  let dragging = false, startX = 0, startI = 0;
  track.style.touchAction = 'pan-y';
  track.addEventListener('pointerdown', (e) => {
    dragging = true; startX = e.clientX; startI = idx();
    track.setPointerCapture(e.pointerId);
  });
  track.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const step = Math.round((e.clientX - startX) / 14);
    apply(startI + step);
    e.preventDefault();
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    try { track.releasePointerCapture(e.pointerId); } catch { /* gone */ }
  };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);

  root.refresh = () => {
    const i = idx();
    value.textContent = format(values[i], i);
    subEl.textContent = sub ? sub(values[i], i) : '';
    ticks.style.setProperty('--pos', `${(i / (values.length - 1)) * 100}%`);
    minus.disabled = i === 0;
    plus.disabled = i === values.length - 1;
  };
  root.refresh();
  return root;
}

/** Continuous value with a proper thumb, for height, tilt, temperature. */
export function sliderControl({ label, min, max, step, format, get, set, sub, accent }) {
  const root = el('div', 'ctl slider');
  if (accent) root.dataset.accent = accent;
  const head = el('div', 'ctl-head');
  head.append(el('span', 'ctl-label', label));
  const subEl = el('span', 'ctl-sub');
  head.append(subEl);
  root.append(head);

  const row = el('div', 'ctl-row');
  const value = el('div', 'ctl-value wide');
  const input = el('input', 'ctl-range');
  input.type = 'range';
  input.min = min; input.max = max; input.step = step;
  input.setAttribute('aria-label', label);
  row.append(value, input);
  root.append(row);

  input.addEventListener('input', () => set(parseFloat(input.value)));

  root.refresh = () => {
    const v = get();
    if (document.activeElement !== input || Math.abs(parseFloat(input.value) - v) > step / 2) {
      input.value = v;
    }
    value.textContent = format(v);
    subEl.textContent = sub ? sub(v) : '';
  };
  root.refresh();
  return root;
}

/** Two to five mutually exclusive choices, as real buttons. */
export function segmented({ label, options, get, set, sub, accent }) {
  const root = el('div', 'ctl segmented');
  if (accent) root.dataset.accent = accent;
  if (label) {
    const head = el('div', 'ctl-head');
    head.append(el('span', 'ctl-label', label));
    const subEl = el('span', 'ctl-sub');
    head.append(subEl);
    root.append(head);
    root._sub = subEl;
  }
  const row = el('div', 'seg-row');
  const btns = options.map((o) => {
    const b = el('button', 'seg-btn', o.label);
    if (o.title) b.title = o.title;
    b.onclick = () => set(o.value);
    row.append(b);
    return b;
  });
  root.append(row);
  root.refresh = () => {
    const v = get();
    options.forEach((o, i) => {
      btns[i].classList.toggle('on', o.value === v);
      btns[i].disabled = !!o.disabled?.();
    });
    if (root._sub) root._sub.textContent = sub ? sub(v) : '';
  };
  root.refresh();
  return root;
}

/** A select, for lists too long to be buttons. */
export function dropdown({ label, options, get, set, sub }) {
  const root = el('div', 'ctl dropdown');
  const head = el('div', 'ctl-head');
  head.append(el('span', 'ctl-label', label));
  const subEl = el('span', 'ctl-sub');
  head.append(subEl);
  root.append(head);
  const sel = el('select', 'ctl-select');
  sel.setAttribute('aria-label', label);
  root.append(sel);
  sel.onchange = () => set(sel.value);
  root.refresh = () => {
    const opts = typeof options === 'function' ? options() : options;
    const v = String(get());
    if (sel.dataset.sig !== JSON.stringify(opts.map((o) => [o.value, o.label, !!o.disabled]))) {
      sel.dataset.sig = JSON.stringify(opts.map((o) => [o.value, o.label, !!o.disabled]));
      sel.innerHTML = '';
      for (const o of opts) {
        const n = el('option', null, o.label);
        n.value = o.value;
        if (o.disabled) n.disabled = true;
        sel.append(n);
      }
    }
    sel.value = v;
    subEl.textContent = sub ? sub(get()) : '';
  };
  root.refresh();
  return root;
}

export function toggle({ label, get, set, hint }) {
  const root = el('button', 'ctl-toggle');
  const l = el('span', null, label);
  const dot = el('span', 'toggle-dot');
  root.append(dot, l);
  if (hint) root.title = hint;
  root.onclick = () => set(!get());
  root.refresh = () => root.classList.toggle('on', !!get());
  root.refresh();
  return root;
}

/** Group of controls with a heading, collapsible on small screens. */
export function panel(title, children = []) {
  const root = el('section', 'panel');
  if (title) root.append(el('h3', 'panel-title', title));
  const body = el('div', 'panel-body');
  children.forEach((c) => c && body.append(c));
  root.append(body);
  root.body = body;
  root.refresh = () => body.childNodes.forEach((c) => c.refresh?.());
  return root;
}
