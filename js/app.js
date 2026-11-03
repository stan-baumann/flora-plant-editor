'use strict';
// Oberfläche: Zustand, Editor, Vorschau, Klang, Datei und Export
/* =====================================================================
   Zustand, Rueckgaengig, Speichern im Browser
   ===================================================================== */
const STORE_KEY = 'flora-editor-v1';
function freshState() {
  return {
    name: t('default.name'),
    code: { angle: 60, length: 4, rot: 90, x: 64, y: 37, maxGen: 1, startGen: 1, axiom: '', rules: [] },
    manual: false,
    draw: { sym: 6, mirror: true, mirrorPitch: true, segs: [], armOffsets: '', nextId: 1 },
  };
}
let S = freshState();
const UI = { tool: 'draw', type: 'F', curGen: 0, viewGen: null, sel: null, grid: true, pitches: true, plant2: true,
  scale: 5, root: 45, ns: 3, ms: 250, loop: false };
let undoStack = [], redoStack = [];
const snapshot = () => JSON.stringify(S);
function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 200) undoStack.shift(); redoStack = []; }
function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); S = JSON.parse(undoStack.pop()); UI.sel = null; syncFromState(); }
function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); S = JSON.parse(redoStack.pop()); UI.sel = null; syncFromState(); }
let saveTimer = 0;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ S, ui: { scale: UI.scale, root: UI.root, ns: UI.ns, ms: UI.ms, lang: LANG } })); } catch (e) { /* kein Speicher verfuegbar */ }
  }, 300);
}
function restore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (d && d.S && d.S.code && d.S.draw) { S = d.S; const { lang, ...rest } = d.ui || {}; Object.assign(UI, rest); return true; }
  } catch (e) { /* ignorieren */ }
  return false;
}

/* =====================================================================
   Ableitungen: Code aus Zeichnung, Generationen, Tonfolge
   ===================================================================== */
let compiled = null;   // letztes Compiler-Ergebnis
let derived = null;    // Generationen, Spuren, Tonfolgen
function recompileFromDrawing() {
  try {
    compiled = compileDrawing(S.draw, S.code.angle, UI.ns);
    S.code.axiom = compiled.axiom;
    S.code.rules = compiled.rules;
    S.code.maxGen = compiled.maxGen;
    S.code.startGen = compiled.maxGen;
    S.manual = false;
  } catch (e) {
    compiled = { warnings: [e.message], effGen: new Map(), error: true };
  }
}
function derive() {
  const c = S.code;
  const gens = grow(c.axiom, c.rules, Math.max(0, c.maxGen | 0));
  const per = gens.map(gg => {
    const ops = trace(gg.s, c.angle, c.rot);
    const ev = melody(gg.s, c.angle, UI.ns);
    return { s: gg.s, cut: gg.cut, ops, ev };
  });
  derived = { gens: per };
}
function viewGen() {
  const max = derived ? derived.gens.length - 1 : 0;
  return UI.viewGen === null ? max : Math.min(UI.viewGen, max);
}
// Linien-Schluessel (alle Symmetrie-Kopien) -> Segment
function copyIndex() {
  const m = new Map();
  for (const c of segCopies(S.draw)) m.set(segKeyXY(c.ax, c.ay, c.bx, c.by), c);
  return m;
}

/* =====================================================================
   DOM
   ===================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const editor = $('#editor'), ectx = editor.getContext('2d');
const preview = $('#preview'), pctx = preview.getContext('2d');
const view = { scale: 34, panX: 0, panY: 40 };
let hover = { seg: null, node: null }, drag = null, pan = null, playIdx = -1;

function fillSelects() {
  SCALES.forEach((s, i) => { const o = document.createElement('option'); o.value = i + 1; $('#scaleSel').appendChild(o); });
  fillScaleNames();
  for (const name of Object.keys(EXAMPLES)) { const o = document.createElement('option'); o.value = name; o.textContent = name; $('#exampleSel').appendChild(o); }
}
function fillScaleNames() { [...$('#scaleSel').options].forEach(o => { o.textContent = `${o.value} ${t('scale.' + o.value)}`; }); }
function fillSym() {
  const sel = $('#symSel'), opts = symOptions(S.code.angle);
  sel.innerHTML = '';
  for (const n of opts) { const o = document.createElement('option'); o.value = n; o.textContent = n === 1 ? t('sym.none') : t('sym.n', { n }); sel.appendChild(o); }
  if (!opts.includes(S.draw.sym)) S.draw.sym = opts.includes(6) ? 6 : opts[opts.length - 1];
  sel.value = S.draw.sym;
}

function syncFromState() {
  const c = S.code;
  $('#plantName').value = S.name;
  $('#cAngle').value = c.angle; $('#cLength').value = c.length; $('#cRot').value = c.rot;
  $('#cX').value = c.x; $('#cY').value = c.y; $('#cMax').value = c.maxGen; $('#cStart').value = c.startGen;
  $('#cAxiom').value = c.axiom;
  $('#cRules').value = c.rules.map(r => `${r[0]} = ${r[1]}`).join('\n');
  const asel = $('#angleSel');
  asel.value = [30, 45, 60, 90].includes(+c.angle) ? String(c.angle) : '';
  fillSym();
  $('#mirrorChk').checked = !!S.draw.mirror;
  $('#mirrorPitchChk').checked = S.draw.mirrorPitch !== false;
  $('#scaleSel').value = UI.scale; $('#rootNote').value = UI.root; $('#noteScalar').value = UI.ns; $('#noteMs').value = UI.ms;
  if (!S.manual) recompileFromDrawing(); else compiled = null;
  refresh();
}
function refreshCodeFields() {
  const c = S.code;
  $('#cAxiom').value = c.axiom;
  $('#cRules').value = c.rules.map(r => `${r[0]} = ${r[1]}`).join('\n');
  $('#cMax').value = c.maxGen; $('#cStart').value = c.startGen;
}
function refresh() {
  derive();
  const max = derived.gens.length - 1;
  const vg = $('#viewGen');
  vg.max = max; vg.value = viewGen(); $('#viewGenLbl').textContent = viewGen();
  renderLegend(); renderStatus(); renderGenTable(); renderMelody(); renderSegPanel();
  drawEditor(); drawPreview();
  $('#btnUndo').disabled = !undoStack.length; $('#btnRedo').disabled = !redoStack.length;
  persist();
}

function renderLegend() {
  const maxG = Math.max(0, ...S.draw.segs.map(s => s.g), UI.curGen);
  let h = '';
  for (let g = 0; g <= Math.min(maxG, 12); g++) h += `<span><i style="background:${genColor(g)}"></i> ${g}</span>`;
  $('#legend').innerHTML = h;
}
function renderStatus() {
  const el = $('#status'), parts = [];
  const last = derived.gens[derived.gens.length - 1];
  if (!S.manual) parts.push(`<span class="ok">${t('st.auto')}</span>`);
  else if (S.manualReason === 'file') parts.push(`<span class="warn">${t('st.file')}</span>`);
  else if (S.manualReason === 'mismatch') parts.push(`<span class="warn">${t('st.mismatch')}</span>`);
  else parts.push(`<span class="warn">${t('st.edit')}</span>`);
  if (compiled && compiled.warnings) for (const w of compiled.warnings) parts.push(`<span class="warn">⚠ ${w}</span>`);
  if (UI.notice) parts.push(`<span class="small">${t(UI.notice)}</span>`);
  if (derived.gens.some(g => g.cut)) parts.push(`<span class="err">${t('st.cut', { max: MAX_LEN })}</span>`);
  if (derived.gens.some(g => g.ev.some(e => !e.rest && (e.note < 1 || e.note > TOP))))
    parts.push(`<span class="warn">${t('st.range')}</span>`);
  const allCode = S.code.axiom + S.code.rules.map(r => r[1]).join('');
  if (/!(?!\d{3})/.test(allCode)) parts.push(`<span class="warn">${t('st.bang')}</span>`);
  for (const [k] of S.code.rules) if (SPECIAL.has(k) || k.length !== 1) parts.push(`<span class="err">${t('st.rule', { k })}</span>`);
  parts.push(`<span class="small">${t('st.last', { len: last.s.length, max: MAX_LEN, n: last.ev.filter(e => !e.rest).length })}</span>`);
  el.innerHTML = parts.join('<br>');
}
function renderGenTable() {
  let h = `<tr><th>${t('tbl.gen')}</th><th>${t('tbl.chars')}</th><th>${t('tbl.notes')}</th><th>${t('tbl.rests')}</th><th></th></tr>`;
  derived.gens.forEach((g, i) => {
    const notes = g.ev.filter(e => !e.rest).length, rests = g.ev.length - notes;
    const flag = g.cut ? `<span class="err">${t('tbl.cut')}</span>` : (g.s.length > MAX_LEN * 0.9 ? `<span class="warn">${t('tbl.tight')}</span>` : '');
    h += `<tr><td>${i}${i === S.code.startGen ? ' ' + t('tbl.start') : ''}</td><td>${g.s.length}</td><td>${notes}</td><td>${rests}</td><td>${flag}</td></tr>`;
  });
  $('#genTable').innerHTML = h;
}
function renderMelody() {
  const ev = derived.gens[viewGen()].ev;
  const notes = scaleNotes(UI.root, UI.scale);
  $('#melody').innerHTML = ev.length ? ev.map((e, k) => {
    if (e.rest) return `<span class="rest" data-i="${e.i}">·</span>`;
    const pi = playableIndex(e.note), bad = e.note < 1 || e.note > TOP;
    const title = pi ? midiName(notes[pi - 1]) : t('mel.mute');
    return `<span class="${bad ? 'bad' : ''}" data-i="${e.i}" title="${title}">${e.note}</span>`;
  }).join(' ') : `<span class="small">${t('mel.none')}</span>`;
}
function selectedSeg() { return S.draw.segs.find(s => s.id === UI.sel) || null; }
function naturalPitches() {
  // Tonhoehe jeder Linie in der angezeigten Generation (fuer Beschriftung)
  const res = new Map();
  if (!derived) return res;
  const g = derived.gens[viewGen()], idx = copyIndex();
  const noteAt = new Map(g.ev.filter(e => !e.rest).map(e => [e.i, e.note]));
  for (const op of g.ops) {
    if (op.c !== 'F') continue;
    const c = idx.get(segKeyXY(op.x0, op.y0, op.x1, op.y1));
    if (c) res.set(c.seg.id + ':' + c.copy, noteAt.get(op.i));
  }
  return res;
}
function renderSegPanel() {
  const s = selectedSeg(), p = $('#segPanel');
  p.classList.toggle('show', !!s && UI.tool === 'select');
  if (!s) return;
  $$('#segPanel [data-st]').forEach(b => b.classList.toggle('on', b.dataset.st === s.t));
  $('#segGen').value = s.g;
  $('#segPitchChk').checked = s.p !== null && s.p !== undefined;
  $('#segPitch').disabled = !$('#segPitchChk').checked || s.t !== 'F';
  $('#segPitchChk').disabled = s.t !== 'F';
  $('#segPitch').value = s.p ?? (naturalPitches().get(s.id + ':0') ?? 12);
  const eg = compiled && compiled.effGen ? compiled.effGen.get(s.id) : undefined;
  const np = naturalPitches().get(s.id + ':0');
  $('#segInfo').textContent = (np !== undefined ? t('seg.now', { n: np }) : '') + (eg !== undefined && eg !== s.g ? t('seg.eff', { g: eg }) : '');
}

/* ---------- Editor zeichnen ---------- */
function resizeEditor() {
  const r = editor.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  editor.width = Math.max(1, Math.round(r.width * dpr)); editor.height = Math.max(1, Math.round(r.height * dpr));
  ectx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawEditor();
}
const W2S = (x, y) => { const r = editor.getBoundingClientRect(); return [r.width / 2 + view.panX + x * view.scale, r.height / 2 + view.panY - y * view.scale]; };
const S2W = (sx, sy) => { const r = editor.getBoundingClientRect(); return [(sx - r.width / 2 - view.panX) / view.scale, -(sy - r.height / 2 - view.panY) / view.scale]; };
function dirs() { const a = S.code.angle, out = []; for (let k = 0; k * a < 360 - 1e-9; k++) out.push(90 + k * a); return out; }
function gridPoints() {
  const a = +S.code.angle, r = editor.getBoundingClientRect(), pts = [];
  if (!UI.grid || ![30, 60, 90].includes(a)) return pts;
  const [x0, y1] = S2W(0, 0), [x1, y0] = S2W(r.width, r.height);
  if (a === 90) {
    for (let i = Math.floor(x0); i <= Math.ceil(x1); i++) for (let j = Math.floor(y0); j <= Math.ceil(y1); j++) pts.push([i, j]);
  } else {
    const c = Math.cos(30 * DEG);
    for (let j = Math.floor(x0 / c) - 1; j <= Math.ceil(x1 / c) + 1; j++) {
      const off = j * 0.5;
      for (let i = Math.floor(y0 - off) - 1; i <= Math.ceil(y1 - off) + 1; i++) pts.push([j * c, i + off]);
    }
  }
  return pts.length > 20000 ? [] : pts;
}
function drawEditor() {
  if (!derived) return;
  const r = editor.getBoundingClientRect(), g = ectx;
  g.clearRect(0, 0, r.width, r.height);
  g.fillStyle = '#0f1216'; g.fillRect(0, 0, r.width, r.height);
  // Raster
  g.fillStyle = '#2d3442';
  for (const [x, y] of gridPoints()) { const [sx, sy] = W2S(x, y); g.fillRect(sx - 1, sy - 1, 2, 2); }
  // Symmetrieachsen
  const n = S.draw.sym || 1, [ox, oy] = W2S(0, 0);
  if (n > 1) {
    g.strokeStyle = '#232a35'; g.lineWidth = 1; g.setLineDash([4, 6]);
    for (let i = 0; i < n; i++) { const d = (90 + i * 360 / n) * DEG; g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.cos(d) * 2000, oy - Math.sin(d) * 2000); g.stroke(); }
    g.setLineDash([]);
  }
  const vg = viewGen(), effGen = (compiled && compiled.effGen) || new Map();
  const pitches = UI.pitches ? naturalPitches() : new Map();
  const idx = copyIndex();
  let playKey = null;
  if (playIdx >= 0) { const op = derived.gens[vg].ops.find(o => o.i === playIdx); if (op) playKey = segKeyXY(op.x0, op.y0, op.x1, op.y1); }
  for (const c of segCopies(S.draw)) {
    const s = c.seg, eg = S.manual ? s.g : (effGen.get(s.id) ?? s.g);
    const vis = eg <= vg, base = c.copy === 0;
    const [ax, ay] = W2S(c.ax, c.ay), [bx, by] = W2S(c.bx, c.by);
    const isSel = UI.sel === s.id, isHover = hover.seg && hover.seg.id === s.id;
    const isPlay = playKey && playKey === segKeyXY(c.ax, c.ay, c.bx, c.by);
    g.globalAlpha = (vis ? 1 : 0.18) * (base ? 1 : 0.45);
    g.strokeStyle = isPlay ? '#ffffff' : genColor(s.g);
    g.lineWidth = (s.t === 'G' ? 2.5 : 3.5) + (isSel || isHover ? 2 : 0) + (isPlay ? 2 : 0);
    g.setLineDash(s.t === 'f' ? [5, 5] : []);
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    g.setLineDash([]);
    if (s.t === 'F') {
      g.fillStyle = g.strokeStyle;
      g.beginPath(); g.arc((ax + bx) / 2, (ay + by) / 2, isSel ? 5 : 4, 0, 7); g.fill();
      const p = pitches.get(s.id + ':' + c.copy);
      if (UI.pitches && p !== undefined && vis && view.scale >= 18) {
        g.globalAlpha = base ? 1 : 0.6;
        g.font = '11px ui-monospace,Consolas,monospace'; g.fillStyle = s.p !== null && s.p !== undefined ? '#ffd166' : '#cfd6e2';
        const nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1;
        g.fillText(String(p), (ax + bx) / 2 + nx / nl * 9 - 4, (ay + by) / 2 + ny / nl * 9 + 4);
      }
    }
    if (isSel) { g.globalAlpha = 1; g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); }
  }
  g.globalAlpha = 1;
  // Knoten
  const nodesSeen = new Set();
  g.fillStyle = '#c9d3e0';
  for (const c of segCopies(S.draw)) for (const [x, y] of [[c.ax, c.ay], [c.bx, c.by]]) {
    const k = pkey(x, y); if (nodesSeen.has(k)) continue; nodesSeen.add(k);
    const [sx, sy] = W2S(x, y); g.globalAlpha = c.copy === 0 ? 0.9 : 0.35; g.beginPath(); g.arc(sx, sy, 2.2, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  // Startpunkt mit Startrichtung
  g.strokeStyle = '#ff6b6b'; g.fillStyle = '#ff6b6b'; g.lineWidth = 2;
  g.beginPath(); g.arc(ox, oy, 6, 0, 7); g.stroke();
  const rd = S.code.rot * DEG;
  g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.cos(rd) * 16, oy - Math.sin(rd) * 16); g.stroke();
  // Hover-Knoten
  if (hover.node && UI.tool === 'draw') { const [sx, sy] = W2S(hover.node[0], hover.node[1]); g.strokeStyle = '#6cc4ff'; g.lineWidth = 2; g.beginPath(); g.arc(sx, sy, 7, 0, 7); g.stroke(); }
  // Linie unter dem Mauszeiger (Radieren, Uebertragen, Auswaehlen) samt Endpunkten markieren, in allen Symmetrie-Kopien
  if (hover.seg && UI.tool !== 'draw' && !pan) {
    const col = UI.tool === 'erase' ? '#ff6b6b' : UI.tool === 'paint' ? genColor(UI.curGen) : '#ffffff';
    g.strokeStyle = col; g.fillStyle = col;
    for (const c of segCopies(S.draw)) {
      if (c.seg.id !== hover.seg.id) continue;
      const [ax, ay] = W2S(c.ax, c.ay), [bx, by] = W2S(c.bx, c.by);
      g.globalAlpha = c.copy === 0 ? 1 : 0.45;
      g.lineWidth = 2; g.setLineDash(UI.tool === 'erase' ? [6, 4] : []);
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); g.setLineDash([]);
      for (const [px, py] of [[ax, ay], [bx, by]]) { g.beginPath(); g.arc(px, py, 6, 0, 7); g.stroke(); }
      if (UI.tool === 'erase' && c.copy === 0) {
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        g.lineWidth = 2.5; g.beginPath(); g.moveTo(mx - 5, my - 5); g.lineTo(mx + 5, my + 5); g.moveTo(mx + 5, my - 5); g.lineTo(mx - 5, my + 5); g.stroke();
      }
    }
    g.globalAlpha = 1;
  }
  // Ziehen
  if (drag && drag.steps > 0) {
    const [sx, sy] = W2S(drag.x, drag.y), d = drag.dir * DEG;
    const ex = drag.x + Math.cos(d) * drag.steps, ey = drag.y + Math.sin(d) * drag.steps, [tx, ty] = W2S(ex, ey);
    g.strokeStyle = genColor(UI.curGen); g.globalAlpha = 0.8; g.lineWidth = 3; g.setLineDash(UI.type === 'f' ? [5, 5] : []);
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(tx, ty); g.stroke(); g.setLineDash([]);
    if (S.draw.mirror) {
      const [mx, my] = W2S(-drag.x, drag.y), [mx2, my2] = W2S(-ex, ey);
      g.globalAlpha = 0.4; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx2, my2); g.stroke();
    }
    g.globalAlpha = 1; g.fillStyle = '#fff'; g.font = '12px system-ui'; g.fillText(t(drag.steps > 1 ? 'drag.steps' : 'drag.step', { n: drag.steps }), tx + 8, ty - 8);
  }
  $('#hint').textContent = S.draw.segs.length ? (S.manual ? t('hint.manual') : '') : t('hint.empty');
}

/* ---------- Vorschau (norns) ---------- */
function drawPreview() {
  const g = pctx, K = 5, c = S.code, vg = viewGen();
  g.fillStyle = '#000'; g.fillRect(0, 0, 640, 320);
  const ops = derived.gens[vg].ops;
  const drawPlant = (dx, col) => {
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = K * 0.9;
    for (const op of ops) {
      if (op.c === 'f') continue;
      const X0 = (c.x + dx + op.x0 * c.length) * K, Y0 = (c.y - op.y0 * c.length) * K;
      const X1 = (c.x + dx + op.x1 * c.length) * K, Y1 = (c.y - op.y1 * c.length) * K;
      const hot = op.i === playIdx;
      if (hot) { g.strokeStyle = '#ff6b6b'; }
      g.beginPath(); g.moveTo(X0, Y0); g.lineTo(X1, Y1); g.stroke();
      if (op.c === 'F') { g.beginPath(); g.arc(X1, Y1, K, 0, 7); g.stroke(); }
      if (hot) g.strokeStyle = col;
    }
  };
  if (UI.plant2) drawPlant(32, '#5a5a5a');
  drawPlant(-32, '#ffffff');
}

/* ---------- Treffer ---------- */
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function hitSeg(sx, sy) {
  let best = null, bd = 9;
  for (const c of segCopies(S.draw)) {
    const [ax, ay] = W2S(c.ax, c.ay), [bx, by] = W2S(c.bx, c.by), d = distToSeg(sx, sy, ax, ay, bx, by);
    if (d < bd) { bd = d; best = c.seg; }
  }
  return best;
}
function hitNode(sx, sy) {
  const cand = [[0, 0]];
  for (const c of segCopies(S.draw)) cand.push([c.ax, c.ay], [c.bx, c.by]);
  for (const p of gridPoints()) cand.push(p);
  let best = null, bd = 11;
  for (const [x, y] of cand) { const [px, py] = W2S(x, y), d = Math.hypot(px - sx, py - sy); if (d < bd) { bd = d; best = [x, y]; } }
  return best;
}

/* ---------- Eigene Dialoge (die Browser-Dialoge confirm/alert sind in manchen Umgebungen gesperrt) ---------- */
let dlgResolve = null;
function ask(text, okLabel = t('ok.continue'), cancelLabel = t('btn.cancel')) {
  if (dlgResolve) dlgResolve(false);
  $('#dlgText').textContent = text;
  $('#dlgOk').textContent = okLabel;
  $('#dlgCancel').textContent = cancelLabel || '';
  $('#dlgCancel').style.display = cancelLabel ? '' : 'none';
  $('#dlg').classList.add('show');
  $('#dlgOk').focus();
  return new Promise(res => { dlgResolve = res; });
}
const info = text => ask(text, 'OK', null);
function closeDlg(result) { $('#dlg').classList.remove('show'); const r = dlgResolve; dlgResolve = null; if (r) r(result); }
$('#dlgOk').addEventListener('click', () => closeDlg(true));
$('#dlgCancel').addEventListener('click', () => closeDlg(false));
$('#dlg').addEventListener('click', e => { if (e.target.id === 'dlg') closeDlg(false); });
$('#dlg').addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeDlg(false); } if (e.key === 'Enter') { e.preventDefault(); closeDlg(true); } });

/* ---------- Zeichnung aendern ---------- */
const needsConfirm = () => S.manual && S.draw.segs.length > 0;
function applyDrawing(mutate) {
  pushUndo();
  mutate();
  recompileFromDrawing();
  refreshCodeFields();
  refresh();
}
function changeDrawing(mutate, onCancel) {
  if (!needsConfirm()) { applyDrawing(mutate); return; }
  drag = null;
  ask(t('ask.change'), t('ok.change'))
    .then(ok => { if (ok) applyDrawing(mutate); else { if (onCancel) onCancel(); refresh(); } });
}
function existingKeys() { const set = new Set(); for (const c of segCopies(S.draw)) set.add(segKeyXY(c.ax, c.ay, c.bx, c.by)); return set; }
function baseNodeKeys() { const set = new Set([pkey(0, 0)]); for (const s of S.draw.segs) { set.add(pkey(s.ax, s.ay)); set.add(pkey(s.bx, s.by)); } return set; }
function addSegments(list) {
  // list: [{ax,ay,bx,by}] in Weltkoordinaten
  const n = S.draw.sym || 1, all = [...list];
  if (S.draw.mirror) for (const s of list) all.push({ ax: -s.ax, ay: s.ay, bx: -s.bx, by: s.by });
  const keys = existingKeys(), nodesBase = baseNodeKeys();
  const added = [];
  for (let s of all) {
    // bei Symmetrie in die Kopie drehen, die an den Grundarm anschliesst
    if (n > 1) {
      for (let i = 0; i < n; i++) {
        const r = rotSeg(s, -i * 360 / n);
        if (nodesBase.has(pkey(r.ax, r.ay)) || nodesBase.has(pkey(r.bx, r.by))) { s = r; break; }
      }
    }
    const k = segKeyXY(s.ax, s.ay, s.bx, s.by);
    if (keys.has(k)) continue;
    const seg = { id: S.draw.nextId++, ax: s.ax, ay: s.ay, bx: s.bx, by: s.by, t: UI.type, g: UI.curGen, p: null };
    S.draw.segs.push(seg); added.push(seg);
    for (let i = 0; i < n; i++) { const r = rotSeg(seg, i * 360 / n); keys.add(segKeyXY(r.ax, r.ay, r.bx, r.by)); }
    nodesBase.add(pkey(seg.ax, seg.ay)); nodesBase.add(pkey(seg.bx, seg.by));
  }
  return added;
}

/* ---------- Maus ---------- */
editor.addEventListener('contextmenu', e => e.preventDefault());
editor.addEventListener('mousedown', e => {
  const r = editor.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
  if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) { pan = { sx, sy, px: view.panX, py: view.panY }; return; }
  if (e.button !== 0) return;
  if (UI.tool === 'draw') {
    const nd = hitNode(sx, sy);
    if (nd) drag = { x: nd[0], y: nd[1], dir: 90, steps: 0 };
  } else if (UI.tool === 'select') {
    const s = hitSeg(sx, sy); UI.sel = s ? s.id : null; refresh();
  } else if (UI.tool === 'erase') {
    const s = hitSeg(sx, sy), confirmFirst = needsConfirm();
    if (s) { hover.seg = null; changeDrawing(() => { S.draw.segs = S.draw.segs.filter(x => x.id !== s.id); if (UI.sel === s.id) UI.sel = null; }); }
    drag = confirmFirst ? null : { erase: true };
  } else if (UI.tool === 'paint') {
    const s = hitSeg(sx, sy), confirmFirst = needsConfirm();
    if (s && (s.t !== UI.type || s.g !== UI.curGen)) changeDrawing(() => { s.t = UI.type; s.g = UI.curGen; if (s.t !== 'F') s.p = null; });
    drag = confirmFirst ? null : { paint: true };
  }
});
window.addEventListener('mousemove', e => {
  const r = editor.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
  if (pan) { view.panX = pan.px + sx - pan.sx; view.panY = pan.py + sy - pan.sy; drawEditor(); return; }
  if (drag && drag.erase) { const s = hitSeg(sx, sy); if (s) { hover.seg = null; S.draw.segs = S.draw.segs.filter(x => x.id !== s.id); recompileFromDrawing(); refreshCodeFields(); refresh(); } return; }
  if (drag && drag.paint) { const s = hitSeg(sx, sy); if (s && (s.t !== UI.type || s.g !== UI.curGen)) { s.t = UI.type; s.g = UI.curGen; if (s.t !== 'F') s.p = null; recompileFromDrawing(); refreshCodeFields(); refresh(); } return; }
  if (drag) {
    const [wx, wy] = S2W(sx, sy), dx = wx - drag.x, dy = wy - drag.y, len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx) / DEG;
    let bestD = 90, bd = 1e9;
    for (const d of dirs()) { const diff = Math.abs(((ang - d) % 360 + 540) % 360 - 180); if (diff < bd) { bd = diff; bestD = d; } }
    drag.dir = bestD; drag.steps = len < 0.35 ? 0 : Math.max(1, Math.round(len));
    drawEditor(); return;
  }
  if (e.target !== editor) return;
  const prev = hover;
  hover = { seg: UI.tool === 'draw' ? null : hitSeg(sx, sy), node: UI.tool === 'draw' ? hitNode(sx, sy) : null };
  if (prev.seg !== hover.seg || String(prev.node) !== String(hover.node)) drawEditor();
});
window.addEventListener('mouseup', () => {
  if (pan) { pan = null; return; }
  if (!drag) return;
  const d = drag; drag = null;
  if (d.erase || d.paint) { refresh(); return; }
  if (d.steps > 0) {
    const list = [], rd = d.dir * DEG;
    for (let k = 0; k < d.steps; k++) {
      list.push({ ax: d.x + Math.cos(rd) * k, ay: d.y + Math.sin(rd) * k, bx: d.x + Math.cos(rd) * (k + 1), by: d.y + Math.sin(rd) * (k + 1) });
    }
    changeDrawing(() => addSegments(list));
  } else drawEditor();
});
editor.addEventListener('wheel', e => {
  e.preventDefault();
  const r = editor.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
  const [wx, wy] = S2W(sx, sy);
  view.scale = Math.max(6, Math.min(120, view.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  const [nx, ny] = W2S(wx, wy);
  view.panX += sx - nx; view.panY += sy - ny;
  drawEditor();
}, { passive: false });

/* ---------- Werkzeuge und Eingaben ---------- */
function setTool(t) { UI.tool = t; hover = { seg: null, node: null }; $$('#tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); editor.style.cursor = t === 'draw' ? 'crosshair' : 'pointer'; refresh(); }
function setType(t) { UI.type = t; $$('#types button').forEach(b => b.classList.toggle('on', b.dataset.type === t)); }
$$('#tools button').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
$$('#types button').forEach(b => b.addEventListener('click', () => setType(b.dataset.type)));
$('#curGen').addEventListener('input', e => { UI.curGen = Math.max(0, parseInt(e.target.value, 10) || 0); renderLegend(); });
$('#angleSel').addEventListener('change', async e => {
  const a = +e.target.value;
  if (S.draw.segs.length) {
    e.target.value = S.code.angle;
    if (!await ask(t('ask.angle'), t('ok.angle'))) return;
  }
  pushUndo();
  S.draw.segs = []; S.code.angle = a; S.manual = false; UI.sel = null;
  syncFromState();
});
$('#symSel').addEventListener('change', e => { const v = +e.target.value; changeDrawing(() => { S.draw.sym = v; }, () => { e.target.value = S.draw.sym; }); });
$('#mirrorChk').addEventListener('change', e => { S.draw.mirror = e.target.checked; persist(); });
$('#mirrorPitchChk').addEventListener('change', e => { const v = e.target.checked; changeDrawing(() => { S.draw.mirrorPitch = v; }, () => { e.target.checked = !v; }); });
$('#gridChk').addEventListener('change', e => { UI.grid = e.target.checked; drawEditor(); });
$('#pitchChk').addEventListener('change', e => { UI.pitches = e.target.checked; drawEditor(); });
$('#plant2Chk').addEventListener('change', e => { UI.plant2 = e.target.checked; drawPreview(); });
$('#btnCenter').addEventListener('click', () => { view.panX = 0; view.panY = 40; view.scale = 34; drawEditor(); });
$('#viewGen').addEventListener('input', e => { UI.viewGen = +e.target.value === derived.gens.length - 1 ? null : +e.target.value; refresh(); });

// Linien-Panel
$$('#segPanel [data-st]').forEach(b => b.addEventListener('click', () => { const s = selectedSeg(); if (s) changeDrawing(() => { s.t = b.dataset.st; if (s.t !== 'F') s.p = null; }); }));
$('#segGen').addEventListener('change', e => { const s = selectedSeg(); if (s) changeDrawing(() => { s.g = Math.max(0, parseInt(e.target.value, 10) || 0); }); });
$('#segPitchChk').addEventListener('change', e => { const s = selectedSeg(); if (s) changeDrawing(() => { s.p = e.target.checked ? Math.max(1, Math.min(TOP, parseInt($('#segPitch').value, 10) || 12)) : null; }); });
$('#segPitch').addEventListener('change', e => { const s = selectedSeg(); if (s && s.p !== null) changeDrawing(() => { s.p = Math.max(1, Math.min(TOP, parseInt(e.target.value, 10) || 12)); }); });
$('#segDel').addEventListener('click', () => { const s = selectedSeg(); if (s) changeDrawing(() => { S.draw.segs = S.draw.segs.filter(x => x.id !== s.id); UI.sel = null; }); });

// Code-Panel
function parseRules(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(\S)\s*(?:=|→|->|:)\s*(.*?)\s*$/);
    if (m) out.push([m[1], m[2].replace(/\s+/g, '')]);
  }
  return out;
}
function codeEdited(markManual) {
  const c = S.code;
  pushUndo();
  c.angle = parseFloat($('#cAngle').value) || 0;
  c.length = parseFloat($('#cLength').value) || 0;
  c.rot = parseFloat($('#cRot').value) || 0;
  c.x = parseFloat($('#cX').value) || 0; c.y = parseFloat($('#cY').value) || 0;
  c.maxGen = Math.max(1, Math.min(30, parseInt($('#cMax').value, 10) || 1));
  c.startGen = Math.max(0, Math.min(c.maxGen, parseInt($('#cStart').value, 10) || 0));
  c.axiom = $('#cAxiom').value.replace(/\s+/g, '');
  c.rules = parseRules($('#cRules').value);
  if (markManual) { S.manual = true; S.manualReason = 'edit'; }
  $('#angleSel').value = [30, 45, 60, 90].includes(c.angle) ? String(c.angle) : '';
  refresh();
}
for (const id of ['#cLength', '#cX', '#cY', '#cStart']) $(id).addEventListener('change', () => codeEdited(false));
for (const id of ['#cAngle', '#cRot', '#cMax']) $(id).addEventListener('change', () => codeEdited(true));
for (const id of ['#cAxiom', '#cRules']) $(id).addEventListener('change', () => codeEdited(true));
$('#plantName').addEventListener('change', e => { S.name = (e.target.value || 'pflanze').replace(/[^\w\-äöüÄÖÜß]+/g, '_'); e.target.value = S.name; persist(); });
$('#btnRecompile').addEventListener('click', async () => {
  if (S.manual && !await ask(t('ask.recompile'), t('ok.recompile'))) return;
  pushUndo(); recompileFromDrawing(); refreshCodeFields(); refresh();
});
$('#btnToDrawing').addEventListener('click', async () => {
  if (![30, 45, 60, 90].includes(+S.code.angle)) { info(t('info.angles')); return; }
  if (S.draw.segs.length && !await ask(t('ask.replace'), t('ok.replace'))) return;
  pushUndo(); buildDrawingFromCode(); refresh();
});
function buildDrawingFromCode() {
  const segs = drawingFromCode(S.code);
  // Import: Toene wie im Code lassen, Angleichung erst auf Wunsch
  S.draw = { sym: 1, mirror: false, mirrorPitch: false, segs: [...segs], armOffsets: '', nextId: segs.length + 1 };
  UI.notice = segs.vanished ? 'notice.vanished' : '';
  fillSym();
  $('#mirrorChk').checked = false;
  $('#mirrorPitchChk').checked = false;
  UI.sel = null;
}
$('#btnFit').addEventListener('click', () => {
  const ops = derived.gens[derived.gens.length - 1].ops.filter(o => o.c !== 'f');
  if (!ops.length) return;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const o of ops) for (const [x, y] of [[o.x0, o.y0], [o.x1, o.y1]]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const w = x1 - x0 || 1, h = y1 - y0 || 1;
  pushUndo();
  S.code.length = Math.max(1, Math.min(8, Math.floor(Math.min(54 / w, 44 / h) * 2) / 2));
  S.code.x = Math.round((64 - (x0 + x1) / 2 * S.code.length) * 2) / 2;
  S.code.y = Math.round((37 + (y0 + y1) / 2 * S.code.length) * 2) / 2;
  syncFromState();
});

// Klang-Einstellungen
$('#scaleSel').addEventListener('change', e => { UI.scale = +e.target.value; renderMelody(); persist(); });
$('#rootNote').addEventListener('change', e => { UI.root = parseInt(e.target.value, 10) || 45; renderMelody(); persist(); });
$('#noteScalar').addEventListener('change', e => {
  UI.ns = Math.max(0, parseFloat(e.target.value) || 0);
  if (!S.manual) { recompileFromDrawing(); refreshCodeFields(); }
  refresh();
});
$('#noteMs').addEventListener('change', e => { UI.ms = Math.max(40, parseInt(e.target.value, 10) || 250); persist(); });
$('#loopChk').addEventListener('change', e => { UI.loop = e.target.checked; });

/* ---------- Klang ---------- */
let actx = null, timers = [], voices = [];
function tone(midi, t, dur) {
  const o = actx.createOscillator(), g = actx.createGain(), f = actx.createBiquadFilter();
  o.type = 'triangle'; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
  f.type = 'lowpass'; f.frequency.value = 2400;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.08, dur * 0.95));
  o.connect(f); f.connect(g); g.connect(actx.destination);
  o.start(t); o.stop(t + dur + 0.05);
  voices.push(o);
}
function stopSound() {
  timers.forEach(clearTimeout); timers = [];
  voices.forEach(v => { try { v.stop(); } catch (e) { /* schon beendet */ } }); voices = [];
  playIdx = -1; $('#btnPlay').classList.remove('on');
  highlightMelody(-1); drawEditor(); drawPreview();
}
function highlightMelody(i) { $$('#melody span').forEach(sp => sp.classList.toggle('cur', +sp.dataset.i === i)); }
function play() {
  stopSound();
  if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { info(t('info.noaudio')); return; } actx = new AC(); }
  if (actx.state === 'suspended') actx.resume();
  const ev = derived.gens[viewGen()].ev;
  if (!ev.length) return;
  const notes = scaleNotes(UI.root, UI.scale), dur = UI.ms / 1000;
  const t0 = actx.currentTime + 0.06;
  $('#btnPlay').classList.add('on');
  ev.forEach((e, k) => {
    const t = t0 + k * dur;
    if (!e.rest) { const pi = playableIndex(e.note); if (pi) tone(notes[pi - 1], t, dur); }
    timers.push(setTimeout(() => { playIdx = e.i; highlightMelody(e.i); drawEditor(); drawPreview(); }, (t - actx.currentTime) * 1000));
  });
  timers.push(setTimeout(() => { if (UI.loop) play(); else stopSound(); }, (t0 + ev.length * dur - actx.currentTime) * 1000 + 30));
}
$('#btnPlay').addEventListener('click', play);
$('#btnStop').addEventListener('click', stopSound);

/* ---------- Datei, Export, Beispiele ---------- */
function loadPlant(text, name) {
  const p = parseFlora(text);
  pushUndo();
  S.name = name || 'pflanze';
  S.code = { angle: p.angle, length: p.length, rot: p.rot, x: p.x, y: p.y, maxGen: Math.max(1, p.maxGen), startGen: p.startGen, axiom: p.axiom, rules: p.rules };
  S.manual = true; S.manualReason = 'file'; UI.notice = '';
  if (p.editor && Array.isArray(p.editor.segs)) {
    // mit dem Editor gespeichert: Zeichnung exakt wiederherstellen und pruefen, ob der Code noch dazu passt
    S.draw = drawingFromMeta(p.editor);
    if (p.editor.ns !== undefined) UI.ns = +p.editor.ns;
    try {
      const cc = compileDrawing(S.draw, S.code.angle, UI.ns);
      const same = cc.axiom === p.axiom && JSON.stringify(cc.rules) === JSON.stringify(p.rules) && cc.maxGen === Math.max(1, p.maxGen);
      if (same) { S.manual = false; S.manualReason = ''; }
      else S.manualReason = 'mismatch';
    } catch (e) { S.manualReason = 'mismatch'; }
  } else if ([30, 45, 60, 90].includes(+p.angle) && Math.abs(p.rot - 90) < 1e-9) {
    buildDrawingFromCode();
    // aeltere Datei ohne Zeichnungsdaten: verknuepfen, wenn der Editor genau diesen Code erzeugen wuerde
    try {
      const cc = compileDrawing(S.draw, S.code.angle, UI.ns);
      if (cc.axiom === p.axiom && JSON.stringify(cc.rules) === JSON.stringify(p.rules) && cc.maxGen === Math.max(1, p.maxGen)) { S.manual = false; S.manualReason = ''; }
    } catch (e) { /* bleibt unverknuepft */ }
  } else S.draw = { sym: 1, mirror: false, segs: [], armOffsets: '', nextId: 1 };
  UI.viewGen = null; UI.sel = null;
  syncFromState();
}
function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function showText(title, text) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = '';
  const ta = document.createElement('textarea'); ta.value = text; ta.readOnly = true; $('#modalBody').appendChild(ta);
  $('#modalCopy').style.display = '';
  $('#modal').classList.add('show'); ta.select();
}
function showHelp() {
  $('#modalTitle').textContent = t('modal.help');
  $('#modalBody').innerHTML = `<div style="max-height:60vh;overflow:auto">${t('help', { max: MAX_LEN })}</div>`;
  $('#modalCopy').style.display = 'none';
  $('#modal').classList.add('show');
}
$('#modalClose').addEventListener('click', () => $('#modal').classList.remove('show'));
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') $('#modal').classList.remove('show'); });
$('#modalCopy').addEventListener('click', async () => {
  const ta = $('#modalBody textarea'); if (!ta) return;
  try { await navigator.clipboard.writeText(ta.value); $('#modalCopy').textContent = t('btn.copied'); }
  catch (e) { ta.select(); document.execCommand('copy'); $('#modalCopy').textContent = t('btn.copied'); }
  setTimeout(() => { $('#modalCopy').textContent = t('btn.copy'); }, 1500);
});
// Zeichnung nur mitspeichern, wenn der Code aus ihr erzeugt ist (sonst passt sie nicht zum Code)
const saveFile = () => download(S.name + '.flora', toFlora(S.code, S.manual ? null : drawingMeta(S.draw, UI.ns)));
$('#btnSave').addEventListener('click', saveFile);
$('#btnSave2').addEventListener('click', saveFile);
$('#btnMaiden').addEventListener('click', () => showText(t('modal.maiden'), toMaiden(S.code, S.name)));
$('#btnCatalog').addEventListener('click', () => showText(t('modal.catalog'), toCatalog(S.code, S.name)));
$('#btnOpen').addEventListener('click', () => $('#fileInput').click());
$('#fileInput').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try { loadPlant(await f.text(), f.name.replace(/\.[^.]*$/, '')); } catch (err) { info(t('info.readerr', { msg: err.message })); }
  e.target.value = '';
});
$('#exampleSel').addEventListener('change', e => {
  const n = e.target.value; e.target.value = '';
  if (n && EXAMPLES[n]) loadPlant(EXAMPLES[n], n);
});
$('#btnNew').addEventListener('click', async () => {
  if ((S.draw.segs.length || S.code.axiom) && !await ask(t('ask.new'), t('ok.new'))) return;
  stopSound(); pushUndo(); S = freshState(); UI.viewGen = null; UI.sel = null; UI.notice = ''; syncFromState();
});
$('#btnUndo').addEventListener('click', undo);
$('#btnRedo').addEventListener('click', redo);
$('#btnHelp').addEventListener('click', showHelp);
window.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if ($('#dlg').classList.contains('show')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (e.key === 'Escape') { drag = null; $('#modal').classList.remove('show'); drawEditor(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedSeg()) { const s = selectedSeg(); changeDrawing(() => { S.draw.segs = S.draw.segs.filter(x => x.id !== s.id); UI.sel = null; }); return; }
  const k = e.key.toLowerCase();
  if (k === 'd') setTool('draw'); else if (k === 's') setTool('select'); else if (k === 'p') setTool('paint'); else if (k === 'e') setTool('erase');
  else if (k === '1') setType('F'); else if (k === '2') setType('G'); else if (k === '3') setType('f');
  else if (k === ' ') { e.preventDefault(); playIdx >= 0 ? stopSound() : play(); }
});
window.addEventListener('resize', resizeEditor);

/* ---------- Sprache umschalten ---------- */
function applyI18n() {
  document.documentElement.lang = LANG;
  document.title = t('app.title');
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  $$('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  $('#langSel').value = LANG;
  fillScaleNames();
}
$('#langSel').addEventListener('change', e => {
  LANG = LANGS.includes(e.target.value) ? e.target.value : 'en';
  // unveraenderten Standardnamen mit uebersetzen
  if (LANGS.some(l => I18N[l]['default.name'] === S.name)) S.name = t('default.name');
  applyI18n();
  if ($('#modal').classList.contains('show') && $('#modalCopy').style.display === 'none') showHelp();
  syncFromState();
});

/* ---------- Selbsttest (Konsole: floraSelfTest()) ---------- */
function geomSet(code, gen) {
  const gens = grow(code.axiom, code.rules, code.maxGen);
  const set = new Set();
  for (const op of trace(gens[Math.min(gen, gens.length - 1)].s, code.angle, 90)) if (op.c !== 'f') set.add(segKeyXY(op.x0, op.y0, op.x1, op.y1));
  return set;
}
const sameSet = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
window.floraSelfTest = function () {
  const res = [];
  for (const [name, text] of Object.entries(EXAMPLES)) {
    const p = parseFlora(text);
    const code = { angle: p.angle, axiom: p.axiom, rules: p.rules, maxGen: p.maxGen };
    const segs = drawingFromCode(code);
    const D = { sym: 1, mirror: false, segs, armOffsets: '' };
    const cc = compile(D, p.angle, 3);
    const code2 = { angle: p.angle, axiom: cc.axiom, rules: cc.rules, maxGen: cc.maxGen };
    const gensOk = [];
    for (let g = 0; g <= p.maxGen; g++) gensOk.push(sameSet(geomSet(code, g), geomSet(code2, g)));
    const len = grow(code2.axiom, code2.rules, code2.maxGen).map(x => x.s.length);
    res.push({ name, endform: gensOk[gensOk.length - 1], verschwindend: segs.vanished, generationen: gensOk.map(b => b ? 'j' : 'N').join(''), laengen: len.join('/'), maxGen: `${p.maxGen}/${cc.maxGen}` });
  }
  return res;
};

/* ---------- Start ---------- */
fillSelects();
applyI18n();
if (!restore()) S = freshState();
syncFromState();
resizeEditor();
