'use strict';
// Flora-Nachbildung und Compiler – ohne Bezug zur Oberfläche
/* =====================================================================
   Flora-Nachbildung: L-System, Turtle, Tonlogik (nach jaseknighter/flora,
   lib/l_system.lua, lib/turtle.lua, lib/plant_sounds.lua)
   ===================================================================== */
const DEG = Math.PI / 180;
const MAX_LEN = 300;        // MAX_SENTENCE_LENGTH in lib/globals.lua
const TOP = 24;             // Laenge der Tonleiter (scale_length)
const LETTERS = 'ABCDEHIJKLMNOPQRSTUVWXYZabcdeghijklmnopqstuvwxyz'.split('');
const SPECIAL = new Set(['F', 'G', 'f', '+', '-', '[', ']', '|', '!', 'r']);
// Reihenfolge wie MusicUtil.SCALES (Nummer = Floras "scale mode")
const SCALES = [
  ['Dur', [0, 2, 4, 5, 7, 9, 11]], ['Natürliches Moll', [0, 2, 3, 5, 7, 8, 10]],
  ['Harmonisches Moll', [0, 2, 3, 5, 7, 8, 11]], ['Melodisches Moll', [0, 2, 3, 5, 7, 9, 11]],
  ['Dorisch', [0, 2, 3, 5, 7, 9, 10]], ['Phrygisch', [0, 1, 3, 5, 7, 8, 10]],
  ['Lydisch', [0, 2, 4, 6, 7, 9, 11]], ['Mixolydisch', [0, 2, 4, 5, 7, 9, 10]],
  ['Lokrisch', [0, 1, 3, 5, 6, 8, 10]], ['Ganzton', [0, 2, 4, 6, 8, 10]],
  ['Dur-Pentatonik', [0, 2, 4, 7, 9]], ['Moll-Pentatonik', [0, 3, 5, 7, 10]],
];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const GEN_COLORS = ['#6cc4ff', '#7ddc8a', '#ffd166', '#ff9f68', '#f78fb3', '#b39cff', '#5ee6d0', '#e0e0e0'];
const genColor = g => GEN_COLORS[g % GEN_COLORS.length];

function grow(axiom, rules, gens) {
  const map = new Map();
  for (const [k, v] of rules) if (k && !map.has(k)) map.set(k, v);
  const out = [{ s: axiom, cut: false }];
  let s = axiom;
  for (let g = 1; g <= gens; g++) {
    let n = '';
    for (const ch of s) n += map.has(ch) ? map.get(ch) : ch;
    const cut = n.length > MAX_LEN;
    if (n.length >= MAX_LEN) n = n.slice(0, MAX_LEN);
    out.push({ s: n, cut });
    s = n;
  }
  return out;
}

// Turtle in Schritt-Einheiten, y nach oben, Startrichtung rot0 (Grad)
function trace(s, angle, rot0 = 90) {
  let x = 0, y = 0, rot = rot0;
  const st = [], ops = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === 'F' || c === 'G' || c === 'f') {
      const nx = x + Math.cos(rot * DEG), ny = y + Math.sin(rot * DEG);
      ops.push({ c, x0: x, y0: y, x1: nx, y1: ny, i });
      x = nx; y = ny;
    } else if (c === '+') rot += angle;
    else if (c === '-') rot -= angle;
    else if (c === '|') rot += 180;
    else if (c === '[') st.push([x, y, rot]);
    else if (c === ']') { if (st.length) [x, y, rot] = st.pop(); }
    else if (c === '!') { const d = s.slice(i + 1, i + 4); if (/^\d{3}$/.test(d)) rot += parseInt(d, 10); }
  }
  return ops;
}

function pitchStep(note, ch, angle, ns) {
  const th = angle * DEG;
  if (ch === '+') { const n = note + Math.ceil(ns * th - 1e-9); return n <= TOP ? n : 1 + (n - TOP); }
  if (ch === '-') { const n = note + Math.ceil(-ns * th - 1e-9); return n > 1 ? n : TOP - n; }
  return note;
}

// Tonfolge wie plant_sounds.set_note: F = Ton, G = Pause, +/- verschieben, ] setzt auf 12 zurueck
function melody(s, angle, ns) {
  let note = null;
  const ev = [];
  for (let i = 0; i < s.length; i++) {
    if (note === null) note = TOP / 2;
    const c = s[i];
    if (c === 'F') ev.push({ i, note });
    else if (c === 'G') ev.push({ i, rest: true });
    else if (c === '+' || c === '-') note = pitchStep(note, c, angle, ns);
    else if (c === ']') note = null;
    else if (c === '!') {
      const d = s.slice(i + 1, i + 4);
      if (/^\d{3}$/.test(d)) { let n = note + Math.ceil(ns * parseInt(d, 10) * DEG); if (n > TOP) n = 1 + (n - TOP); note = n; }
    }
  }
  return ev;
}

function scaleNotes(root, mode) {
  const iv = (SCALES[mode - 1] || SCALES[4])[1], out = [];
  for (let i = 0; i < TOP; i++) out.push(root + 12 * Math.floor(i / iv.length) + iv[i % iv.length]);
  return out;
}
function playableIndex(n) { if (n <= 0) n = TOP + n; if (n > TOP) n = n - TOP; return (n >= 1 && n <= TOP) ? n : null; }
const midiName = m => NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

// Kuerzeste formneutrale Zeichenfolge, die nach "[]" (Stufe 12) die Zielstufe erreicht
const pitchTableCache = new Map();
function pitchTable(angle, ns) {
  const ck = angle + '|' + ns;
  if (pitchTableCache.has(ck)) return pitchTableCache.get(ck);
  const m = Math.round(180 / angle);
  const toks = ['+-', '|' + '-'.repeat(m), '|' + '+'.repeat(m)];
  const apply = (n, t) => { for (const c of t) n = pitchStep(n, c, angle, ns); return n; };
  const best = new Map([[12, '']]);
  let frontier = [12];
  while (frontier.length) {
    const nf = [];
    for (const n of frontier) for (const t of toks) {
      const v = apply(n, t);
      if (v < 1 || v > TOP) continue;
      const str = best.get(n) + t;
      if (!best.has(v) || best.get(v).length > str.length) { best.set(v, str); nf.push(v); }
    }
    frontier = nf;
  }
  pitchTableCache.set(ck, best);
  return best;
}

/* =====================================================================
   .flora-Format (tab.save)
   ===================================================================== */
function parseFlora(text) {
  const tables = {};
  let cur = null, id = null;
  const val = v => {
    v = v.trim();
    let m;
    if ((m = v.match(/^\{(\d+)\}$/))) return { ref: +m[1] };
    if ((m = v.match(/^"((?:[^"\\]|\\.)*)"$/))) return m[1].replace(/\\(.)/g, (_, c) => c === 'n' ? '\n' : c);
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (v !== '' && !isNaN(+v)) return +v;
    return v;
  };
  let editor = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    let m;
    if (line.startsWith('-- flora-editor ')) { try { editor = JSON.parse(line.slice(16)); } catch (e) { editor = null; } continue; }
    if ((m = line.match(/^-- Table: \{(\d+)\}/))) { id = +m[1]; continue; }
    if (line === '{' && id !== null) { cur = { arr: [], obj: {} }; tables[id] = cur; continue; }
    if (/^\},?$/.test(line)) { cur = null; continue; }
    if (!cur || !line) continue;
    const body = line.replace(/,$/, '');
    if ((m = body.match(/^\["((?:[^"\\]|\\.)*)"\]=(.*)$/))) cur.obj[m[1]] = val(m[2]);
    else if ((m = body.match(/^\[(\d+)\]=(.*)$/))) cur.arr[+m[1] - 1] = val(m[2]);
    else cur.arr.push(val(body));
  }
  const resolve = (t, seen = new Set()) => {
    if (!t) return null;
    const conv = v => (v && typeof v === 'object' && 'ref' in v) ? (seen.has(v.ref) ? null : resolve(tables[v.ref], new Set([...seen, v.ref]))) : v;
    if (t.arr.length && !Object.keys(t.obj).length) return t.arr.map(conv);
    const o = {};
    for (const k in t.obj) o[k] = conv(t.obj[k]);
    t.arr.forEach((v, i) => { o[i + 1] = conv(v); });
    return o;
  };
  const root = resolve(tables[1], new Set([1]));
  if (!root || root.axiom === undefined) throw new Error(t('err.noplant'));
  const rules = (Array.isArray(root.ruleset) ? root.ruleset : []).filter(r => Array.isArray(r) && r.length >= 2).map(r => [String(r[0]), String(r[1])]);
  return {
    angle: +root.angle || 0, axiom: String(root.axiom), rot: root.initial_turtle_rotation !== undefined ? +root.initial_turtle_rotation : 90,
    length: root.length !== undefined ? +root.length : 4, maxGen: root.max_generations !== undefined ? +root.max_generations : 1,
    startGen: root.starting_generation !== undefined ? +root.starting_generation : 0,
    x: root.start_from && root.start_from.x !== undefined ? +root.start_from.x : 64,
    y: root.start_from && root.start_from.y !== undefined ? +root.start_from.y : 58, rules, editor,
  };
}
const luaStr = s => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
const num = v => String(Math.round(v * 1000) / 1000);
function exportRules(c) { return c.rules.length ? c.rules : [['Z', 'Z']]; }
function toFlora(c, meta) {
  const rules = exportRules(c);
  const L = ['return {', '-- Table: {1}', '{',
    `   ["angle"]=${num(c.angle)},`, `   ["axiom"]=${luaStr(c.axiom)},`, `   ["initial_turtle_rotation"]=${num(c.rot)},`,
    `   ["length"]=${num(c.length)},`, `   ["max_generations"]=${Math.max(1, c.maxGen)},`, '   ["ruleset"]={2},',
    '   ["start_from"]={3},', `   ["starting_generation"]=${c.startGen},`, '},', '-- Table: {2}', '{'];
  rules.forEach((_, i) => L.push(`   {${4 + i}},`));
  L.push('},', '-- Table: {3}', '{', `   ["x"]=${num(c.x)},`, `   ["y"]=${num(c.y)},`, '},');
  rules.forEach((r, i) => L.push(`-- Table: {${4 + i}}`, '{', `   ${luaStr(r[0])},`, `   ${luaStr(r[1])},`, '},'));
  L[L.length - 1] = '}';
  L.push('}');
  // Zeichnung als Lua-Kommentar anhaengen: Flora ignoriert ihn, der Editor stellt daraus die Zeichnung wieder her
  if (meta) L.push('-- flora-editor ' + JSON.stringify(meta));
  return L.join('\n');
}
const r6 = v => Math.round(v * 1e6) / 1e6;
function drawingMeta(D, ns) {
  return { v: 1, ns, sym: D.sym, mirror: !!D.mirror, mirrorPitch: D.mirrorPitch !== false, armOffsets: D.armOffsets || '',
    segs: D.segs.map(s => [r6(s.ax), r6(s.ay), r6(s.bx), r6(s.by), s.t, s.g, s.p ?? null]) };
}
function drawingFromMeta(m) {
  const segs = (m.segs || []).map((a, i) => ({ id: i + 1, ax: +a[0], ay: +a[1], bx: +a[2], by: +a[3], t: a[4], g: +a[5] || 0, p: a[6] ?? null }));
  // aeltere Dateien ohne mirrorPitch wurden ohne Angleichung gespeichert
  return { sym: +m.sym || 1, mirror: !!m.mirror, mirrorPitch: m.mirrorPitch === true, segs, armOffsets: m.armOffsets || '', nextId: segs.length + 1 };
}
function toMaiden(c, name) {
  const rl = exportRules(c).map(r => `{${luaStr(r[0])},${luaStr(r[1])}}`).join(',');
  return `local p={angle=${num(c.angle)},axiom=${luaStr(c.axiom)},initial_turtle_rotation=${num(c.rot)},length=${num(c.length)},` +
    `max_generations=${Math.max(1, c.maxGen)},starting_generation=${c.startGen},start_from={x=${num(c.x)},y=${num(c.y)}},ruleset={${rl}}} ` +
    `util.make_dir(_path.data.."flora/nursery") tab.save(p,_path.data.."flora/nursery/${name}.flora") print("gespeichert: ${name}.flora")`;
}
function toCatalog(c, name) {
  const rl = exportRules(c).map(r => `      {${luaStr(r[0])},${luaStr(r[1])}}`).join(',\n');
  const dx = Math.round((c.x - 64) * 1000) / 1000, dy = Math.round((64 - c.y) * 1000) / 1000;
  return `  {\n    -- ${name}\n    start_from = vector:new(screen_size.x/2 ${dx < 0 ? '-' : '+'} ${Math.abs(dx)}, screen_size.y - ${dy}),\n` +
    `    ruleset = {\n${rl}\n    },\n    axiom = ${luaStr(c.axiom)},\n    max_generations = ${Math.max(1, c.maxGen)},\n` +
    `    length = ${num(c.length)},\n    angle = ${num(c.angle)},\n    initial_turtle_rotation = ${num(c.rot)},\n    starting_generation = ${c.startGen}\n  }`;
}

/* =====================================================================
   Zeichnung: Liniensegmente der Laenge 1 auf dem Winkelraster
   ===================================================================== */
const pkey = (x, y) => Math.round(x * 1000) + ',' + Math.round(y * 1000);
function segKeyXY(ax, ay, bx, by) { const a = pkey(ax, ay), b = pkey(bx, by); return a < b ? a + '|' + b : b + '|' + a; }
const segKey = s => segKeyXY(s.ax, s.ay, s.bx, s.by);
function rotP(x, y, deg) { const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG); return [x * c - y * s, x * s + y * c]; }
function rotSeg(s, deg) { const [ax, ay] = rotP(s.ax, s.ay, deg), [bx, by] = rotP(s.bx, s.by, deg); return { ...s, ax, ay, bx, by }; }
function symOptions(angle) {
  return [1, 2, 3, 4, 6, 8, 12].filter(n => Math.abs((360 / n) / angle - Math.round((360 / n) / angle)) < 1e-9);
}
// alle sichtbaren Kopien (Symmetrie) einer Zeichnung
function segCopies(D) {
  const out = [], n = D.sym || 1;
  for (let i = 0; i < n; i++) for (const s of D.segs) out.push({ seg: s, copy: i, ...rotSeg(s, i * 360 / n) });
  return out;
}

/* Compiler: Zeichnung -> Axiom + Regeln.
   Tiefensuche vom Startpunkt; Aeste in [ ], der laengste Ast ohne Klammern.
   Jede Linie erscheint in ihrer Generation: spaetere Teile stecken hinter
   Hilfsbuchstaben, die pro Generation eine Stufe weiterwachsen. */
function compile(D, angle, ns, tmpPitch) {
  const warnings = [];
  const nodes = new Map();
  const node = (x, y) => { const k = pkey(x, y); if (!nodes.has(k)) nodes.set(k, { k, x, y, edges: [] }); return nodes.get(k); };
  const O = node(0, 0);
  const edges = D.segs.map(s => { const u = node(s.ax, s.ay), v = node(s.bx, s.by); const e = { s, u, v }; u.edges.push(e); v.edges.push(e); return e; });
  const less = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  // Baum: Wege mit moeglichst frueher Generation bevorzugen
  const dist = new Map([[O.k, [0, 0]]]), parent = new Map(), done = new Set();
  for (;;) {
    let best = null;
    for (const [k, d] of dist) if (!done.has(k) && (!best || less(d, dist.get(best)))) best = k;
    if (!best) break;
    done.add(best);
    const n = nodes.get(best), d = dist.get(best);
    for (const e of n.edges) {
      const o = e.u === n ? e.v : e.u;
      const nd = [Math.max(d[0], e.s.g), d[1] + 1];
      if (!done.has(o.k) && (!dist.has(o.k) || less(nd, dist.get(o.k)))) { dist.set(o.k, nd); parent.set(o.k, e); }
    }
  }
  const kids = new Map(), effGen = new Map();
  const addKid = (n, item) => { if (!kids.has(n.k)) kids.set(n.k, []); kids.get(n.k).push(item); };
  let unreached = 0;
  for (const e of edges) {
    if (!dist.has(e.u.k) || !dist.has(e.v.k)) { unreached++; continue; }
    if (parent.get(e.v.k) === e) addKid(e.u, { e, to: e.v, tree: true });
    else if (parent.get(e.u.k) === e) addKid(e.v, { e, to: e.u, tree: true });
    else if (less(dist.get(e.v.k), dist.get(e.u.k))) addKid(e.v, { e, to: e.u, tree: false });
    else addKid(e.u, { e, to: e.v, tree: false });
  }
  if (unreached) warnings.push(t('w.unreached', { n: unreached }));

  const rules = new Map(), memo = new Map();
  let li = 0, maxG = 0;
  const letterFor = body => {
    if (memo.has(body)) return memo.get(body);
    if (li >= LETTERS.length) throw new Error(t('err.letters'));
    const L = LETTERS[li++];
    memo.set(body, L); rules.set(L, body);
    return L;
  };
  const defer = (body, d) => { let s = body; for (let k = 0; k < d; k++) s = letterFor(s); return s; };
  const turn = (h, d) => {
    let delta = ((d - h) % 360 + 540) % 360 - 180;
    if (Math.abs(delta + 180) < 1e-6) delta = 180;
    if (Math.abs(Math.abs(delta) - 180) < 1e-6) return '|';
    const k = Math.round(delta / angle);
    const plain = (k > 0 ? '+' : '-').repeat(Math.abs(k));
    const d2 = delta > 0 ? delta - 180 : delta + 180, k2 = Math.round(d2 / angle);
    const alt = '|' + (k2 > 0 ? '+' : '-').repeat(Math.abs(k2));
    return alt.length < plain.length ? alt : plain;
  };
  const table = pitchTable(angle, ns);
  const prefix = (s, off) => {
    const want = s.p ?? (tmpPitch ? tmpPitch.get(s.id) : undefined);
    if (s.t !== 'F' || want === null || want === undefined) return '';
    const t = Math.max(1, Math.min(TOP, want + off));
    if (table.has(t)) return '[]' + table.get(t);
    let bt = 12; for (const k of table.keys()) if (Math.abs(k - t) < Math.abs(bt - t)) bt = k;
    return '[]' + table.get(bt);
  };
  // frueheste Generation in einem Ast (Spruenge zaehlen nur, wenn nichts dahinter kommt)
  const minMemo = new Map();
  const minGen = c => {
    if (minMemo.has(c)) return minMemo.get(c);
    let m = c.e.s.t === 'f' ? Infinity : c.e.s.g;
    if (c.tree) for (const k of (kids.get(c.to.k) || [])) m = Math.min(m, minGen(k));
    if (m === Infinity) m = c.e.s.g;
    minMemo.set(c, m);
    return m;
  };
  const emit = (n, h, p, off) => {
    const list = (kids.get(n.k) || []).map(c => {
      const dir = Math.atan2(c.to.y - n.y, c.to.x - n.x) / DEG;
      const m = Math.max(p, minGen(c)), s = c.e.s;
      const g = s.t === 'f' ? m : Math.max(m, s.g);
      maxG = Math.max(maxG, g);
      effGen.set(s.id, g);
      // Linie waechst spaeter als der Ast dahinter: erst unsichtbar ueberspringen, spaeter zeichnen
      const own = g > m ? '[' + defer(prefix(s, off) + s.t, g - m) + ']f' : prefix(s, off) + s.t;
      const body = turn(h, dir) + own + (c.tree ? emit(c.to, dir, m, off) : '');
      return defer(body, m - p);
    });
    list.sort((a, b) => a.length - b.length);
    return list.map((b, i) => i < list.length - 1 ? '[' + b + ']' : b).join('');
  };
  const n = D.sym || 1, step = 360 / n;
  const offs = String(D.armOffsets || '').split(/[,;\s]+/).filter(x => x !== '').map(Number);
  let axiom;
  if (n === 1) axiom = emit(O, 90, 0, offs[0] || 0);
  else {
    const arms = [];
    for (let i = 0; i < n; i++) arms.push(emit(O, 90, 0, offs[i] || 0));
    // Die Drehung zwischen den Armen verschiebt in Flora die Tonhoehe. "[]" stellt sie danach wieder auf
    // Stufe 12 (wie am Anfang des ersten Arms), damit jede Kopie genau wie der gezeichnete Arm klingt.
    let sep = turn(0, step);
    if (/[+-]/.test(sep)) sep += '[]';
    axiom = arms.every(a => a === '') ? '' : arms.map((a, i) => i < n - 1 ? '[' + a + ']' + sep : a).join('');
  }
  return { axiom, rules: [...rules.entries()], maxGen: Math.max(1, maxG), warnings, effGen };
}

function copyIndexOf(D) {
  const m = new Map();
  for (const c of segCopies(D)) m.set(segKeyXY(c.ax, c.ay, c.bx, c.by), c);
  return m;
}
// Tonhoehe jeder Ton-Linie (Grundarm) in der letzten Generation eines Compiler-Ergebnisses
function pitchBySeg(cc, D, angle, ns) {
  const gens = grow(cc.axiom, cc.rules, cc.maxGen), s = gens[gens.length - 1].s;
  const noteAt = new Map(melody(s, angle, ns).filter(e => !e.rest).map(e => [e.i, e.note]));
  const idx = copyIndexOf(D), res = new Map();
  for (const op of trace(s, angle, 90)) {
    if (op.c !== 'F') continue;
    const c = idx.get(segKeyXY(op.x0, op.y0, op.x1, op.y1));
    if (c && c.copy === 0 && !res.has(c.seg.id)) res.set(c.seg.id, noteAt.get(op.i));
  }
  return res;
}
/* Wie compile, aber gespiegelte Ton-Linien (an der senkrechten Achse) spielen denselben Ton wie ihr Original.
   Flora dreht fuer das Spiegelbild in die Gegenrichtung und landet so auf einer anderen Stufe; hier bekommt
   die Linie dann eine feste Tonhoehe. Hat nur eine Seite eine feste Tonhoehe, folgt ihr die andere. */
function compileDrawing(D, angle, ns) {
  let cc = compile(D, angle, ns);
  if (D.mirrorPitch === false) return cc;
  const idx = copyIndexOf(D), pairs = [];
  for (const s of D.segs) {
    if (s.t !== 'F') continue;
    const c = idx.get(segKeyXY(-s.ax, s.ay, -s.bx, s.by));
    if (c && c.seg.id !== s.id && c.seg.t === 'F' && s.id < c.seg.id) pairs.push([s, c.seg]);
  }
  if (!pairs.length) return cc;
  const base = cc, P0 = pitchBySeg(base, D, angle, ns), table = pitchTable(angle, ns);
  const isFixed = s => s.p !== null && s.p !== undefined;
  const cost = (s, w) => (isFixed(s) || P0.get(s.id) === w) ? 0 : (table.has(w) ? 2 + table.get(w).length : 99);
  // 'orig': Spiegelbild uebernimmt den Ton des Originals; 'cheap': gemeinsamer Ton mit den wenigsten Zusatzzeichen
  const targetOf = (a, b, mode) => {
    if (isFixed(a)) return a.p;
    if (isFixed(b)) return b.p;
    const pa = P0.get(a.id), pb = P0.get(b.id);
    if (mode === 'orig' || pa === undefined) return pa;
    let best = pa, bc = Infinity;
    for (const w of [pa, pb, 12, 13, 11]) { if (w === undefined) continue; const c = cost(a, w) + cost(b, w); if (c < bc) { bc = c; best = w; } }
    return best;
  };
  const tooLong = r => grow(r.axiom, r.rules, r.maxGen).some(g => g.cut);
  const run = mode => {
    const tmp = new Map();
    let r = base;
    for (let it = 0; it < 6; it++) {
      const P = it === 0 ? P0 : pitchBySeg(r, D, angle, ns);
      let changed = false;
      for (const [a, b] of pairs) {
        const want = targetOf(a, b, mode);
        if (want === undefined) continue;
        for (const s of [a, b]) {
          if (isFixed(s)) continue;
          if (P.get(s.id) !== want && tmp.get(s.id) !== want) { tmp.set(s.id, want); changed = true; }
        }
      }
      if (!changed) break;
      r = compile(D, angle, ns, tmp);
    }
    return r;
  };
  const orig = run('orig');
  if (!tooLong(orig)) return orig;
  const cheap = run('cheap');
  if (!tooLong(cheap)) { cheap.warnings.push(t('w.mirrorCheap', { max: MAX_LEN })); return cheap; }
  base.warnings.push(t('w.mirrorOff', { max: MAX_LEN }));
  return base;
}

// Code -> Zeichnung: die Linien der letzten Generation, jede mit der Generation, ab der sie zu sehen ist.
// Linien, die beim Wachsen wieder verschwinden, kann eine Zeichnung nicht darstellen; sie fallen weg.
function drawingFromCode(c) {
  const gens = grow(c.axiom, c.rules, Math.max(0, c.maxGen));
  const rank = { f: 0, G: 1, F: 2 }, finalSeg = new Map();
  for (const op of trace(gens[gens.length - 1].s, c.angle, 90)) {
    const k = segKeyXY(op.x0, op.y0, op.x1, op.y1);
    if (!finalSeg.has(k)) finalSeg.set(k, { ax: op.x0, ay: op.y0, bx: op.x1, by: op.y1, t: op.c });
    else if (rank[op.c] > rank[finalSeg.get(k).t]) finalSeg.get(k).t = op.c;
  }
  // ab welcher Generation ist die Linie ohne Unterbrechung bis zum Ende sichtbar?
  const present = gens.map(gg => {
    const set = new Set();
    for (const op of trace(gg.s, c.angle, 90)) if (op.c !== 'f') set.add(segKeyXY(op.x0, op.y0, op.x1, op.y1));
    return set;
  });
  let id = 1, vanished = 0;
  for (let g = 0; g < present.length - 1; g++) for (const k of present[g]) if (!finalSeg.has(k)) vanished++;
  const segs = [...finalSeg.entries()].map(([k, s]) => {
    let g = present.length - 1;
    if (s.t !== 'f') while (g > 0 && present[g - 1].has(k)) g--;
    else g = 0;
    return { id: id++, ax: s.ax, ay: s.ay, bx: s.bx, by: s.by, g, t: s.t, p: null };
  });
  segs.vanished = vanished;
  return segs;
}

