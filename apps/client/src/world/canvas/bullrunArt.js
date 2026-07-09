/* ============================================================
 Bull Run — shared art library (ES module port of the design
 spec bullrun-art.js — keep in sync with the spec folder).
 Pure canvas drawing: tiles, props, buildings, bulls, people.
 World space: 1 unit = one tile; iso(x,y) => screen px.
 ============================================================ */
const TW = 32, TH = 16;
const iso0 = (x, y) => ({ x: (x - y) * TW, y: (x + y) * TH });

function hash(x, y, s) { const n = Math.sin(x * 127.1 + y * 311.7 + (s || 0) * 74.7) * 43758.5453; return n - Math.floor(n); }
function parseCol(c) {
  if (c[0] === '#') { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const m = c.match(/(\d+)[, ]+(\d+)[, ]+(\d+)/); return m ? [+m[1], +m[2], +m[3]] : [128, 128, 128];
}
function mul(c, f) { const [r, g, b] = parseCol(c); const cl = v => Math.max(0, Math.min(255, Math.round(v * f))); return 'rgb(' + cl(r) + ',' + cl(g) + ',' + cl(b) + ')'; }
function mix(c1, c2, tt) { const a = parseCol(c1), b = parseCol(c2); const ch = i => Math.round(a[i] + (b[i] - a[i]) * tt); return 'rgb(' + ch(0) + ',' + ch(1) + ',' + ch(2) + ')'; }

// box with auto-shaded faces (top brightest, left darkest)
function cube(ctx, iso, wx, wy, wd, dd, h, elev, base, faces) {
  const top = (faces && faces.top) || mul(base, 1.0);
  const left = (faces && faces.left) || mul(base, 0.55);
  const right = (faces && faces.right) || mul(base, 0.78);
  const c1 = iso(wx, wy), c2 = iso(wx + wd, wy), c3 = iso(wx + wd, wy + dd), c4 = iso(wx, wy + dd);
  const e = elev, hh = elev + h;
  ctx.fillStyle = right;
  ctx.beginPath(); ctx.moveTo(c2.x, c2.y - hh); ctx.lineTo(c3.x, c3.y - hh); ctx.lineTo(c3.x, c3.y - e); ctx.lineTo(c2.x, c2.y - e); ctx.closePath(); ctx.fill();
  ctx.fillStyle = left;
  ctx.beginPath(); ctx.moveTo(c4.x, c4.y - hh); ctx.lineTo(c3.x, c3.y - hh); ctx.lineTo(c3.x, c3.y - e); ctx.lineTo(c4.x, c4.y - e); ctx.closePath(); ctx.fill();
  ctx.fillStyle = top;
  ctx.beginPath(); ctx.moveTo(c1.x, c1.y - hh); ctx.lineTo(c2.x, c2.y - hh); ctx.lineTo(c3.x, c3.y - hh); ctx.lineTo(c4.x, c4.y - hh); ctx.closePath(); ctx.fill();
}

/* --- wall decals: parallelogram patches that follow an iso face ---
   axis 'x': patch runs along world x (use on a wall facing +y / the left face)
   axis 'y': patch runs along world y (use on a wall facing +x / the right face)
   (wx,wy) start corner on the wall plane, du = length in world units,
   elev = bottom height px, h = patch height px. */
function decalCorners(iso, wx, wy, du, axis, elev, h) {
  const p0 = iso(wx, wy);
  const p1 = axis === 'x' ? iso(wx + du, wy) : iso(wx, wy + du);
  return [
    { x: p0.x, y: p0.y - elev - h }, { x: p1.x, y: p1.y - elev - h },
    { x: p1.x, y: p1.y - elev }, { x: p0.x, y: p0.y - elev }
  ];
}
function decal(ctx, iso, wx, wy, du, axis, elev, h, col) {
  const c = decalCorners(iso, wx, wy, du, axis, elev, h);
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(c[0].x, c[0].y); ctx.lineTo(c[1].x, c[1].y); ctx.lineTo(c[2].x, c[2].y); ctx.lineTo(c[3].x, c[3].y);
  ctx.closePath(); ctx.fill();
}
function decalFrame(ctx, iso, wx, wy, du, axis, elev, h, col, lw) {
  const c = decalCorners(iso, wx, wy, du, axis, elev, h);
  ctx.strokeStyle = col; ctx.lineWidth = lw || 1.6; ctx.beginPath();
  ctx.moveTo(c[0].x, c[0].y); ctx.lineTo(c[1].x, c[1].y); ctx.lineTo(c[2].x, c[2].y); ctx.lineTo(c[3].x, c[3].y);
  ctx.closePath(); ctx.stroke();
}
// line between two world points at given elevations (follows any face)
function faceLine(ctx, iso, x1, y1, e1, x2, y2, e2, col, lw) {
  const p1 = iso(x1, y1), p2 = iso(x2, y2);
  ctx.strokeStyle = col; ctx.lineWidth = lw || 1.6;
  ctx.beginPath(); ctx.moveTo(p1.x, p1.y - e1); ctx.lineTo(p2.x, p2.y - e2); ctx.stroke();
}

function diamond(ctx, iso, x, y, col) {
  const s = iso(x, y);
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + TW, s.y + TH); ctx.lineTo(s.x, s.y + TH * 2); ctx.lineTo(s.x - TW, s.y + TH); ctx.closePath(); ctx.fill();
}
function shadow(ctx, iso, x, y, rx, ry) {
  const s = iso(x, y);
  ctx.fillStyle = 'rgba(15,25,8,.22)'; ctx.beginPath(); ctx.ellipse(s.x, s.y, rx, ry, 0, 0, 7); ctx.fill();
}
function label(ctx, iso, wx, wy, txt, yOff, color) {
  const s = iso(wx, wy);
  ctx.font = "600 11px 'Pixelify Sans', monospace";
  const w = ctx.measureText(txt).width + 10;
  ctx.fillStyle = 'rgba(23,16,10,.8)'; ctx.fillRect(s.x - w / 2, s.y - yOff - 13, w, 16);
  ctx.fillStyle = color || '#f3e7cd'; ctx.textAlign = 'center';
  ctx.fillText(txt, s.x, s.y - yOff - 1); ctx.textAlign = 'left';
}

/* ================= ground tiles ================= */
const GRASS = ['#7cbf54', '#76b94e', '#70b249', '#81c45a'];
function tile(ctx, iso, x, y, type) {
  const h1 = hash(x, y, 1), h2 = hash(x, y, 2), h3 = hash(x, y, 3);
  const s = iso(x, y);
  if (type === 'g1' || type === 'g2') {
    diamond(ctx, iso, x, y, GRASS[Math.floor(h1 * 4)]);
    ctx.fillStyle = 'rgba(38,88,28,.22)';
    for (let i = 0; i < 3; i++) {
      const a = hash(x, y, 4 + i), b = hash(x, y, 8 + i);
      ctx.fillRect(s.x + (a - 0.5) * 40, s.y + 6 + b * 18, 2, 2);
    }
    if (h2 < 0.12) {
      const tx = s.x + (h3 - 0.5) * 26, ty = s.y + 12 + h1 * 10;
      ctx.strokeStyle = '#569a3a'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tx, ty); ctx.lineTo(tx - 2, ty - 6);
      ctx.moveTo(tx + 2, ty); ctx.lineTo(tx + 2, ty - 7);
      ctx.moveTo(tx + 4, ty); ctx.lineTo(tx + 6, ty - 5);
      ctx.stroke();
    } else if (h2 > 0.965) {
      const fx = s.x + (h3 - 0.5) * 24, fy = s.y + 12 + h1 * 10;
      ctx.fillStyle = h1 < 0.5 ? '#f3ead0' : '#f2c94c';
      ctx.fillRect(fx - 1.5, fy - 1.5, 3, 3);
      ctx.fillStyle = '#c98a2e'; ctx.fillRect(fx - 0.5, fy - 0.5, 1.2, 1.2);
    }
  } else if (type === 'dirt') {
    diamond(ctx, iso, x, y, h1 < 0.5 ? '#b58a5a' : '#ae8353');
    ctx.fillStyle = 'rgba(88,58,30,.28)';
    for (let i = 0; i < 2; i++) { const a = hash(x, y, 5 + i), b = hash(x, y, 9 + i); ctx.fillRect(s.x + (a - 0.5) * 36, s.y + 8 + b * 14, 3, 2); }
    if (h2 < 0.1) { ctx.fillStyle = '#997247'; ctx.beginPath(); ctx.ellipse(s.x + (h3 - 0.5) * 22, s.y + 14 + h1 * 8, 3, 1.6, 0, 0, 7); ctx.fill(); }
  } else if (type === 'trk1' || type === 'trk2') {
    diamond(ctx, iso, x, y, type === 'trk1' ? '#cfa871' : '#c8a069');
    ctx.fillStyle = 'rgba(118,78,38,.2)';
    for (let i = 0; i < 3; i++) { const a = hash(x, y, 6 + i), b = hash(x, y, 10 + i); ctx.fillRect(s.x + (a - 0.5) * 40, s.y + 6 + b * 18, 2.5, 1.6); }
    if (h2 < 0.16) {
      ctx.strokeStyle = 'rgba(108,68,33,.38)'; ctx.lineWidth = 1.4;
      const tx = s.x + (h3 - 0.5) * 24, ty = s.y + 12 + h1 * 9;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + 5, ty + 2.5); ctx.moveTo(tx + 2, ty - 3); ctx.lineTo(tx + 7, ty - 0.5); ctx.stroke();
    }
  } else if (type === 'stone') {
    diamond(ctx, iso, x, y, h1 < 0.5 ? '#c2c2bd' : '#bbbbb5');
    if (h2 < 0.3) {
      ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(s.x - TW * 0.5, s.y + TH * 0.5); ctx.lineTo(s.x + TW * 0.5, s.y + TH * 1.5); ctx.stroke();
    }
  } else {
    diamond(ctx, iso, x, y, '#7cbf54');
  }
}

/* ================= props ================= */
function tree(ctx, iso, o, dead) {
  const gx = o.x, gy = o.y;
  if (dead) { // stump
    shadow(ctx, iso, gx, gy, 9, 4.5);
    cube(ctx, iso, gx - 0.18, gy - 0.18, 0.36, 0.36, 5, 0, '#8a6a44');
    const s = iso(gx, gy);
    ctx.strokeStyle = '#6f5432'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(s.x, s.y - 5, 6, 3, 0, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(s.x, s.y - 5, 3, 1.5, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = '#a5764a'; ctx.fillRect(s.x + 7, s.y - 2, 4, 2); ctx.fillRect(s.x - 11, s.y + 1, 3, 2);
    return;
  }
  const sc = o.big ? 1.3 : 1;
  const g1 = hash(gx, gy, 1) < 0.5 ? '#4fae3d' : '#47a53a';
  shadow(ctx, iso, gx, gy, 13 * sc, 6 * sc);
  // root flare + trunk (tall enough to clear the canopy's front corner)
  cube(ctx, iso, gx - 0.2 * sc, gy - 0.2 * sc, 0.4 * sc, 0.4 * sc, 3.5 * sc, 0, '#6f5432');
  cube(ctx, iso, gx - 0.15 * sc, gy - 0.15 * sc, 0.3 * sc, 0.3 * sc, 11 * sc, 3.5 * sc, '#7d5c39');
  cube(ctx, iso, gx - 0.12 * sc, gy - 0.12 * sc, 0.24 * sc, 0.24 * sc, 11 * sc, 14.5 * sc, '#8a6a44');
  // canopy tiers (narrow + high so the trunk stays visible below)
  cube(ctx, iso, gx - 0.48 * sc, gy - 0.48 * sc, 0.96 * sc, 0.96 * sc, 11 * sc, 25 * sc, g1);
  cube(ctx, iso, gx - 0.34 * sc, gy - 0.34 * sc, 0.68 * sc, 0.68 * sc, 9 * sc, 36 * sc, mul(g1, 1.12));
  cube(ctx, iso, gx - 0.18 * sc, gy - 0.18 * sc, 0.36 * sc, 0.36 * sc, 6.5 * sc, 45 * sc, mul(g1, 1.25));
}

function ore(ctx, iso, o, dead, t) {
  const gx = o.x, gy = o.y;
  if (dead) {
    shadow(ctx, iso, gx, gy, 12, 5);
    cube(ctx, iso, gx - 0.35, gy - 0.25, 0.5, 0.4, 3.5, 0, '#9a9a94');
    cube(ctx, iso, gx + 0.1, gy - 0.05, 0.3, 0.3, 2.5, 0, '#8f8f89');
    cube(ctx, iso, gx - 0.1, gy + 0.15, 0.25, 0.22, 2, 0, '#a5a59f');
    return;
  }
  shadow(ctx, iso, gx, gy, 16, 7);
  cube(ctx, iso, gx - 0.52, gy + 0.18, 0.34, 0.3, 6.5, 0, '#b0b0aa');
  cube(ctx, iso, gx - 0.42, gy - 0.32, 0.84, 0.64, 14, 0, '#a8a8a2');
  // gold veins
  cube(ctx, iso, gx - 0.22, gy - 0.18, 0.24, 0.24, 4, 14, '#f2b23a');
  cube(ctx, iso, gx + 0.26, gy + 0.02, 0.16, 0.16, 4, 4.5, '#f2b23a');
  cube(ctx, iso, gx - 0.44, gy + 0.22, 0.14, 0.14, 3.5, 6.5, '#e8a33d');
  // sparkle
  const s = iso(gx, gy);
  const a = 0.35 + 0.5 * Math.abs(Math.sin((t || 0) * 2.2 + gx * 3.1));
  ctx.strokeStyle = 'rgba(255,245,215,' + a.toFixed(2) + ')'; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(s.x - 4, s.y - 20); ctx.lineTo(s.x - 4, s.y - 14);
  ctx.moveTo(s.x - 7, s.y - 17); ctx.lineTo(s.x - 1, s.y - 17);
  ctx.stroke();
}

function hay(ctx, iso, o, dead) {
  const gx = o.x, gy = o.y;
  const s = iso(gx, gy);
  if (dead) { // loose straw left behind
    ctx.strokeStyle = 'rgba(200,170,80,.65)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s.x - 9, s.y + 2); ctx.lineTo(s.x - 3, s.y - 1);
    ctx.moveTo(s.x + 1, s.y + 3); ctx.lineTo(s.x + 8, s.y);
    ctx.moveTo(s.x - 4, s.y + 6); ctx.lineTo(s.x + 4, s.y + 4);
    ctx.moveTo(s.x + 6, s.y - 2); ctx.lineTo(s.x + 12, s.y - 4);
    ctx.stroke();
    return;
  }
  shadow(ctx, iso, gx, gy, 17, 7.5);
  // bale lying along x, rounded look via inset lighter cap
  cube(ctx, iso, gx - 0.45, gy - 0.28, 0.9, 0.56, 12, 0, '#e0c66c');
  cube(ctx, iso, gx - 0.4, gy - 0.23, 0.8, 0.46, 2.2, 12, '#eed98a');
  // twine straps wrapping the cross-section (over the top + down the front face)
  for (const xc of [-0.17, 0.15]) {
    faceLine(ctx, iso, gx + xc, gy - 0.28, 14.4, gx + xc, gy + 0.28, 14.4, '#a5793c', 2);
    const p = iso(gx + xc, gy + 0.28);
    ctx.strokeStyle = '#a5793c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.x, p.y - 12); ctx.lineTo(p.x, p.y); ctx.stroke();
  }
  // end swirl on the +x face (rotated to follow the face plane)
  const e = iso(gx + 0.45, gy);
  ctx.save();
  ctx.translate(e.x, e.y - 6);
  ctx.rotate(-0.4636);
  ctx.strokeStyle = '#b08d3f'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.ellipse(0, 0, 6, 4.2, 0, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, 2.6, 1.8, 0, 0, 7); ctx.stroke();
  ctx.restore();
  // stray straw
  ctx.strokeStyle = 'rgba(230,205,120,.8)'; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(s.x - 15, s.y + 4); ctx.lineTo(s.x - 9, s.y + 1);
  ctx.moveTo(s.x + 10, s.y + 6); ctx.lineTo(s.x + 16, s.y + 4);
  ctx.stroke();
}

/* ================= buildings ================= */
function smoke(ctx, sx, sy, t, seed) {
  for (let i = 0; i < 3; i++) {
    const ph = ((t * 0.35) + i * 0.33 + (seed || 0)) % 1;
    const a = (1 - ph) * 0.3;
    ctx.fillStyle = 'rgba(235,230,220,' + a.toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(sx + Math.sin(ph * 6 + i) * 4, sy - ph * 24, 2.5 + ph * 3.5, 0, 7);
    ctx.fill();
  }
}

function house(ctx, iso, o, t) {
  const gx = o.x, gy = o.y;
  shadow(ctx, iso, gx, gy + 0.4, 44, 18);
  // stone footing + plaster walls
  cube(ctx, iso, gx - 1.05, gy - 1.05, 2.1, 2.1, 6, 0, '#9a9182');
  cube(ctx, iso, gx - 1, gy - 1, 2, 2, 20, 6, '#e2d0a8');
  // timber corner posts
  cube(ctx, iso, gx - 1.02, gy - 1.02, 0.1, 0.1, 20, 6, '#6b4a33');
  cube(ctx, iso, gx + 0.92, gy - 1.02, 0.1, 0.1, 20, 6, '#6b4a33');
  cube(ctx, iso, gx - 1.02, gy + 0.92, 0.1, 0.1, 20, 6, '#6b4a33');
  cube(ctx, iso, gx + 0.92, gy + 0.92, 0.1, 0.1, 20, 6, '#6b4a33');
  // ---- front (+y) face: door + small window, drawn as face decals ----
  const FY = gy + 1.001;
  decal(ctx, iso, gx - 0.6, FY, 0.5, 'x', 6, 16, '#5e3d26');
  decalFrame(ctx, iso, gx - 0.6, FY, 0.5, 'x', 6, 16, '#41291a', 1.6);
  // door knob
  decal(ctx, iso, gx - 0.22, FY, 0.06, 'x', 12.5, 2, '#f2b23a');
  // door step
  cube(ctx, iso, gx - 0.62, gy + 1.0, 0.54, 0.2, 2, 0, '#9a9182');
  // small front window
  decal(ctx, iso, gx + 0.2, FY, 0.42, 'x', 14, 7.5, '#bfe3ef');
  decalFrame(ctx, iso, gx + 0.2, FY, 0.42, 'x', 14, 7.5, '#6b4a33', 1.6);
  faceLine(ctx, iso, gx + 0.41, FY, 14, gx + 0.41, FY, 21.5, '#6b4a33', 1.3);
  decal(ctx, iso, gx + 0.16, FY, 0.5, 'x', 12.5, 1.5, '#6b4a33');
  // ---- right (+x) face: window with cross + sill ----
  const FX = gx + 1.001;
  decal(ctx, iso, FX, gy - 0.45, 0.5, 'y', 13, 9, '#bfe3ef');
  decalFrame(ctx, iso, FX, gy - 0.45, 0.5, 'y', 13, 9, '#6b4a33', 1.6);
  faceLine(ctx, iso, FX, gy - 0.2, 13, FX, gy - 0.2, 22, '#6b4a33', 1.3);
  faceLine(ctx, iso, FX, gy - 0.45, 17.5, FX, gy + 0.05, 17.5, '#6b4a33', 1.3);
  decal(ctx, iso, FX, gy - 0.5, 0.6, 'y', 11.5, 1.5, '#6b4a33');
  // roof: 3 tiers
  cube(ctx, iso, gx - 1.22, gy - 1.22, 2.44, 2.44, 5, 26, '#8e5b3a');
  cube(ctx, iso, gx - 0.92, gy - 0.92, 1.84, 1.84, 5, 31, '#9c6540');
  cube(ctx, iso, gx - 0.52, gy - 0.52, 1.04, 1.04, 4.5, 36, '#aa7048');
  // chimney + smoke
  cube(ctx, iso, gx + 0.42, gy - 0.72, 0.32, 0.32, 11, 34, '#8a8078');
  cube(ctx, iso, gx + 0.39, gy - 0.75, 0.38, 0.38, 2, 45, '#9c948c');
  const ch = iso(gx + 0.58, gy - 0.56);
  smoke(ctx, ch.x, ch.y - 48, t || 0, hash(gx, gy, 7));
}

function stable(ctx, iso, o, opts) {
  const gx = o.x, gy = o.y;
  shadow(ctx, iso, gx, gy + 0.4, 50, 20);
  cube(ctx, iso, gx - 1.25, gy - 1.05, 2.5, 2.1, 5, 0, '#8f8375');
  cube(ctx, iso, gx - 1.2, gy - 1, 2.4, 2, 20, 5, '#9e3d2c');
  // white trim
  cube(ctx, iso, gx - 1.22, gy - 1.02, 0.1, 0.1, 20, 5, '#e8e0cc');
  cube(ctx, iso, gx + 1.12, gy - 1.02, 0.1, 0.1, 20, 5, '#e8e0cc');
  cube(ctx, iso, gx - 1.22, gy + 0.92, 0.1, 0.1, 20, 5, '#e8e0cc');
  cube(ctx, iso, gx + 1.12, gy + 0.92, 0.1, 0.1, 20, 5, '#e8e0cc');
  // ---- front (+y) face: big barn door with white X + hayloft ----
  const FY = gy + 1.001;
  decal(ctx, iso, gx - 0.42, FY, 0.84, 'x', 5, 15, '#5e2119');
  const dc = decalCorners(iso, gx - 0.42, FY, 0.84, 'x', 5, 15);
  ctx.strokeStyle = '#e8e0cc'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(dc[0].x, dc[0].y); ctx.lineTo(dc[1].x, dc[1].y); ctx.lineTo(dc[2].x, dc[2].y); ctx.lineTo(dc[3].x, dc[3].y); ctx.closePath();
  ctx.moveTo(dc[0].x, dc[0].y); ctx.lineTo(dc[2].x, dc[2].y);
  ctx.moveTo(dc[1].x, dc[1].y); ctx.lineTo(dc[3].x, dc[3].y);
  ctx.stroke();
  // hayloft opening with hay, above the door
  decal(ctx, iso, gx - 0.2, FY, 0.4, 'x', 21.5, 6.5, '#41291a');
  decal(ctx, iso, gx - 0.18, FY, 0.36, 'x', 21.5, 3, '#dfc468');
  decalFrame(ctx, iso, gx - 0.2, FY, 0.4, 'x', 21.5, 6.5, '#e8e0cc', 1.6);
  // gambrel roof
  cube(ctx, iso, gx - 1.42, gy - 1.2, 2.84, 2.4, 5, 25, '#5e4527');
  cube(ctx, iso, gx - 1.05, gy - 0.88, 2.1, 1.76, 5, 30, '#6b4f2d');
  cube(ctx, iso, gx - 0.6, gy - 0.5, 1.2, 1.0, 4, 35, '#7a5b34');
  // weathervane
  cube(ctx, iso, gx - 0.03, gy - 0.03, 0.06, 0.06, 6, 39, '#3a3a3d');
  cube(ctx, iso, gx - 0.12, gy - 0.03, 0.24, 0.05, 1.5, 44, '#c9a06a');
  // hay pile beside
  cube(ctx, iso, gx + 1.35, gy + 0.25, 0.5, 0.42, 7, 0, '#dfc468');
  cube(ctx, iso, gx + 1.48, gy + 0.02, 0.32, 0.3, 5, 0, '#ead584');
  if (o.label) label(ctx, iso, gx, gy, o.label + (opts && opts.stableLevel ? ' · Lv ' + opts.stableLevel : ''), 52, '#f2b23a');
}

function awningStand(ctx, iso, gx, gy, c1, c2) {
  // counter
  cube(ctx, iso, gx - 0.85, gy - 0.65, 1.7, 1.3, 9, 0, '#7a4e2e', { top: '#9a6a3e' });
  // corner posts
  cube(ctx, iso, gx - 0.88, gy - 0.68, 0.09, 0.09, 20, 0, '#e8e0cc');
  cube(ctx, iso, gx + 0.79, gy - 0.68, 0.09, 0.09, 20, 0, '#e8e0cc');
  cube(ctx, iso, gx - 0.88, gy + 0.59, 0.09, 0.09, 20, 0, '#e8e0cc');
  cube(ctx, iso, gx + 0.79, gy + 0.59, 0.09, 0.09, 20, 0, '#e8e0cc');
  // striped awning
  for (let i = 0; i < 4; i++) {
    cube(ctx, iso, gx - 0.98 + i * 0.49, gy - 0.78, 0.49, 1.56, 4, 20, i % 2 ? c2 : c1);
  }
  // scalloped front edge — follows the front (+y) face slope
  for (let i = 0; i < 4; i++) {
    decal(ctx, iso, gx - 0.98 + i * 0.49, gy + 0.78, 0.49, 'x', 16.5, 3.5, i % 2 ? c2 : c1);
  }
}
function booth(ctx, iso, o) {
  const gx = o.x, gy = o.y;
  shadow(ctx, iso, gx, gy + 0.3, 38, 15);
  awningStand(ctx, iso, gx, gy, '#3b6ea5', '#e8e0cc');
  if (o.label) label(ctx, iso, gx, gy, o.label, 42, '#7ec8e3');
}
function market(ctx, iso, o) {
  const gx = o.x, gy = o.y;
  shadow(ctx, iso, gx, gy + 0.3, 38, 15);
  awningStand(ctx, iso, gx, gy, '#c9573f', '#e8e0cc');
  // barrel beside — bands follow both visible faces
  cube(ctx, iso, gx + 1.1, gy + 0.4, 0.4, 0.4, 10, 0, '#8a5f38');
  decal(ctx, iso, gx + 1.1, gy + 0.801, 0.4, 'x', 2.5, 1.4, '#3f2c18');
  decal(ctx, iso, gx + 1.1, gy + 0.801, 0.4, 'x', 6.5, 1.4, '#3f2c18');
  decal(ctx, iso, gx + 1.501, gy + 0.4, 0.4, 'y', 2.5, 1.4, mul('#3f2c18', 0.8));
  decal(ctx, iso, gx + 1.501, gy + 0.4, 0.4, 'y', 6.5, 1.4, mul('#3f2c18', 0.8));
  if (o.label) label(ctx, iso, gx, gy, o.label, 42, '#e0c96a');
}

function forge(ctx, iso, o, t) {
  const gx = o.x, gy = o.y;
  shadow(ctx, iso, gx, gy + 0.3, 40, 16);
  // anvil on a stump — drawn first so the building sits in front of it
  shadow(ctx, iso, gx - 1.31, gy + 0.74, 10, 4.5);
  cube(ctx, iso, gx - 1.5, gy + 0.55, 0.38, 0.38, 5, 0, '#6f5432');
  cube(ctx, iso, gx - 1.56, gy + 0.59, 0.5, 0.3, 4, 5, '#3a3a3d');
  cube(ctx, iso, gx - 1.62, gy + 0.65, 0.14, 0.18, 2.5, 6.5, '#4a4a4e');
  // stone body
  cube(ctx, iso, gx - 0.95, gy - 0.75, 1.9, 1.5, 26, 0, '#7d7d76');
  // stone texture blocks on the front face
  decal(ctx, iso, gx - 0.7, gy + 0.751, 0.28, 'x', 3, 2.6, 'rgba(0,0,0,.13)');
  decal(ctx, iso, gx + 0.15, gy + 0.751, 0.3, 'x', 8, 2.6, 'rgba(0,0,0,.13)');
  decal(ctx, iso, gx - 0.3, gy + 0.751, 0.24, 'x', 12, 2.6, 'rgba(0,0,0,.13)');
  decal(ctx, iso, gx + 0.05, gy + 0.751, 0.3, 'x', 17, 2.6, 'rgba(0,0,0,.13)');
  decal(ctx, iso, gx - 0.6, gy + 0.751, 0.26, 'x', 21.5, 2.6, 'rgba(0,0,0,.13)');
  decal(ctx, iso, gx + 0.951, gy - 0.4, 0.3, 'y', 6, 2.6, 'rgba(0,0,0,.16)');
  decal(ctx, iso, gx + 0.951, gy + 0.2, 0.26, 'y', 11.5, 2.6, 'rgba(0,0,0,.16)');
  decal(ctx, iso, gx + 0.951, gy - 0.15, 0.28, 'y', 17.5, 2.6, 'rgba(0,0,0,.16)');
  // furnace mouth on the front (+y) face with fire
  decal(ctx, iso, gx - 0.38, gy + 0.752, 0.62, 'x', 0, 11, '#241a10');
  decal(ctx, iso, gx - 0.31, gy + 0.753, 0.48, 'x', 0, 8, 'rgba(240,120,40,' + (0.6 + 0.3 * Math.sin((t || 0) * 5 + 1)).toFixed(2) + ')');
  decal(ctx, iso, gx - 0.2, gy + 0.754, 0.26, 'x', 0, 5, 'rgba(255,220,120,' + (0.5 + 0.4 * Math.sin((t || 0) * 7)).toFixed(2) + ')');
  // roof slab
  cube(ctx, iso, gx - 1.1, gy - 0.9, 2.2, 1.8, 4, 26, '#4a4a45');
  // chimney with ember glow
  cube(ctx, iso, gx + 0.32, gy - 0.48, 0.45, 0.45, 15, 30, '#5a5a54');
  const glow = 0.55 + 0.35 * Math.sin((t || 0) * 4);
  const chTop = iso(gx + 0.55, gy - 0.25);
  ctx.fillStyle = 'rgba(240,140,60,' + glow.toFixed(2) + ')';
  ctx.fillRect(chTop.x - 4, chTop.y - 46.5, 8, 3);
  smoke(ctx, chTop.x, chTop.y - 50, t || 0, 0.5);
  if (o.label) label(ctx, iso, gx, gy, o.label, 56, '#e07840');
}

/* wooden walkover footbridge — arched span across the track.
   o.len = span in world units (along x, or y when o.dir==='y') */
function bridge(ctx, iso, o) {
  const gx = o.x, gy = o.y, L = o.len || 5, dy = o.dir === 'y';
  const wood = '#b08d55', woodD = '#8a6538', railC = '#c9a06a';
  const W = 0.42;             // half deck width
  const half = L / 2;
  const arcH = 38;            // apex underside elevation px — tall enough to clear the track fences
  const slabH = 2.4;
  const elev = (u) => 2 + arcH * (1 - (u / half) * (u / half)); // arch profile
  // axis-swap helpers so the same geometry works in both orientations
  const C = (u, v, du, dv, h, e, col) => dy ? cube(ctx, iso, gx + v, gy + u, dv, du, h, e, col) : cube(ctx, iso, gx + u, gy + v, du, dv, h, e, col);
  const FL = (u1, v1, e1, u2, v2, e2, col, lw) => dy ? faceLine(ctx, iso, gx + v1, gy + u1, e1, gx + v2, gy + u2, e2, col, lw) : faceLine(ctx, iso, gx + u1, gy + v1, e1, gx + u2, gy + v2, e2, col, lw);
  const SH = (u, v, rx, ry) => dy ? shadow(ctx, iso, gx + v, gy + u, rx, ry) : shadow(ctx, iso, gx + u, gy + v, rx, ry);
  // shadow strip under the span
  for (let u = -half + 0.5; u <= half - 0.5 + 0.01; u += 1) SH(u, 0, 15, 6.5);
  // support legs following the arch — only near the ends so none stand on the track
  for (const u of [-half * 0.78, half * 0.78]) {
    const e = elev(u);
    C(u - 0.09, -W, 0.18, 0.18, e, 0, '#7a5a38');
    C(u - 0.09, W - 0.18, 0.18, 0.18, e, 0, '#7a5a38');
  }
  // arched plank deck — short slabs back-to-front, tops following the arc
  const nSeg = Math.max(10, Math.round(L / 0.28));
  const sw = L / nSeg;
  for (let i = 0; i < nSeg; i++) {
    const u0 = -half + i * sw, uc = u0 + sw / 2;
    C(u0, -W, sw + 0.02, W * 2, slabH, elev(uc), mul(wood, i % 2 ? 0.95 : 1));
  }
  // railings — posts + double rail following the arch (far edge first)
  const nP = Math.max(4, Math.round(L / 0.8));
  for (const v of [-W, W - 0.06]) {
    const pts = [];
    for (let i = 0; i <= nP; i++) {
      const u = -half + (i / nP) * (L - 0.06);
      const et = elev(u + 0.03) + slabH;
      pts.push({ u: u + 0.03, et });
      C(u, v, 0.06, 0.06, 6.5, et, woodD);
    }
    for (let i = 0; i < nP; i++) {
      FL(pts[i].u, v + 0.03, pts[i].et + 6.5, pts[i + 1].u, v + 0.03, pts[i + 1].et + 6.5, railC, 2.2);
      FL(pts[i].u, v + 0.03, pts[i].et + 3.4, pts[i + 1].u, v + 0.03, pts[i + 1].et + 3.4, woodD, 1.6);
    }
  }
  if (o.label) label(ctx, iso, gx, gy, o.label, 44, '#e0c96a');
}

function racebooth(ctx, iso, o, t) {
  const gx = o.x, gy = o.y;
  shadow(ctx, iso, gx, gy + 0.25, 34, 14);
  // kiosk body
  cube(ctx, iso, gx - 0.7, gy - 0.55, 1.4, 1.1, 15, 0, '#b08d55');
  // corner trim
  cube(ctx, iso, gx - 0.72, gy - 0.57, 0.09, 0.09, 15, 0, '#8a6538');
  cube(ctx, iso, gx + 0.63, gy - 0.57, 0.09, 0.09, 15, 0, '#8a6538');
  cube(ctx, iso, gx - 0.72, gy + 0.48, 0.09, 0.09, 15, 0, '#8a6538');
  cube(ctx, iso, gx + 0.63, gy + 0.48, 0.09, 0.09, 15, 0, '#8a6538');
  // ticket window + counter on the front (+y) face
  decal(ctx, iso, gx - 0.3, gy + 0.551, 0.6, 'x', 6.5, 6.5, '#241a10');
  decalFrame(ctx, iso, gx - 0.3, gy + 0.551, 0.6, 'x', 6.5, 6.5, '#8a6538', 1.6);
  decal(ctx, iso, gx - 0.36, gy + 0.552, 0.72, 'x', 4.5, 2, '#8a6538');
  // amber roof tiers
  cube(ctx, iso, gx - 0.88, gy - 0.7, 1.76, 1.4, 4, 15, '#f2b23a');
  cube(ctx, iso, gx - 0.52, gy - 0.42, 1.04, 0.84, 3.5, 19, '#e8a33d');
  cube(ctx, iso, gx - 0.2, gy - 0.16, 0.4, 0.32, 3, 22.5, '#d0991f');
  // flag pole + checkered flag
  cube(ctx, iso, gx + 0.55, gy - 0.48, 0.05, 0.05, 12, 20, '#3a3a3d');
  const fp = iso(gx + 0.575, gy - 0.455);
  const wave = Math.sin((t || 0) * 3) * 1.2;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    ctx.fillStyle = (i + j) % 2 ? '#efe9dc' : '#17100a';
    ctx.fillRect(fp.x + 1 + i * 5, fp.y - 31.5 + j * 4 + i * wave * 0.5, 5, 4);
  }
  if (o.label) label(ctx, iso, gx, gy, o.label, 40, '#f2b23a');
}

function sign(ctx, iso, o) {
  const gx = o.x, gy = o.y;
  cube(ctx, iso, gx - 0.06, gy - 0.06, 0.12, 0.12, 14, 0, '#7a5a38');
  cube(ctx, iso, gx - 0.5, gy - 0.07, 1.0, 0.14, 7, 12, '#c9a06a');
  // scribble lines follow the board's front face
  decal(ctx, iso, gx - 0.38, gy + 0.071, 0.76, 'x', 16.2, 1.2, '#8a6538');
  decal(ctx, iso, gx - 0.38, gy + 0.071, 0.58, 'x', 13.8, 1.2, '#8a6538');
  if (o.label) label(ctx, iso, gx, gy, o.label, 26, '#f2b23a');
}

function post(ctx, iso, o) {
  const v = 0.9 + hash(o.x, o.y, 2) * 0.2;
  cube(ctx, iso, o.x - 0.09, o.y - 0.09, 0.18, 0.18, 13, 0, mul('#9a7748', v));
  cube(ctx, iso, o.x - 0.06, o.y - 0.06, 0.12, 0.12, 1.8, 13, mul('#b08d55', v));
}
function rail(ctx, iso, o) {
  const p1 = iso(o.x1, o.y1), p2 = iso(o.x2, o.y2);
  ctx.lineCap = 'round';
  for (const hgt of [5.5, 10.5]) {
    ctx.strokeStyle = '#7a5a38'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y - hgt); ctx.lineTo(p2.x, p2.y - hgt); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,210,.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y - hgt - 1); ctx.lineTo(p2.x, p2.y - hgt - 1); ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

/* ================= characters ================= */
function toolDraw(ctx, sx, sy, ang, tool, jab) {
  const j = jab || 0;
  const x0 = sx + Math.cos(ang) * j, y0 = sy + Math.sin(ang) * j;
  const len = 15;
  const ex = x0 + Math.cos(ang) * len, ey = y0 + Math.sin(ang) * len;
  ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(ex, ey); ctx.stroke();
  if (tool === 'axe') {
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang + Math.PI / 2);
    ctx.fillStyle = '#b8bcc0'; ctx.fillRect(-1.5, -5.5, 5, 10);
    ctx.restore();
  } else if (tool === 'pick') { // double-headed pickaxe
    ctx.strokeStyle = '#9aa0a6'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(ex, ey, 5.5, ang + 0.7, ang + 2.45); ctx.stroke();
    ctx.beginPath(); ctx.arc(ex, ey, 5.5, ang - 2.45, ang - 0.7); ctx.stroke();
  } else if (tool === 'pitchfork') { // crossbar + three tines
    const px = Math.cos(ang + Math.PI / 2), py = Math.sin(ang + Math.PI / 2);
    ctx.strokeStyle = '#c9ccd0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ex - px * 4.5, ey - py * 4.5); ctx.lineTo(ex + px * 4.5, ey + py * 4.5); ctx.stroke();
    for (const i of [-4, 0, 4]) {
      ctx.beginPath();
      ctx.moveTo(ex + px * i, ey + py * i);
      ctx.lineTo(ex + px * i + Math.cos(ang) * 6.5, ey + py * i + Math.sin(ang) * 6.5);
      ctx.stroke();
    }
  } else { // sickle
    ctx.strokeStyle = '#c9ccd0'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(ex, ey, 5.5, ang - 2.45, ang - 0.7); ctx.stroke();
  }
  ctx.lineCap = 'butt';
}
function person(ctx, iso, o) {
  const gx = o.x, gy = o.y;
  const isMe = o.t === 'player';
  const gear = o.gear || {};
  const shirt = gear.outfit || (isMe ? '#e8a33d' : (o.shirt || '#4a72c4'));
  const skin = '#e8c49a';
  const hands = gear.gloves || skin;
  const pants = isMe ? '#5a4632' : '#3f3542';
  const ph = o.ph || 0;
  const walking = !!o.moving;
  const sw = walking ? Math.sin(ph) : 0;
  const bob = walking ? Math.abs(Math.cos(ph)) * 1.2 : 0;
  shadow(ctx, iso, gx, gy, 9, 4.5);
  const anchor = iso(gx, gy);
  if (o.flip) { ctx.save(); ctx.translate(2 * anchor.x, 0); ctx.scale(-1, 1); }
  // legs — alternate lift while walking (+ boots)
  cube(ctx, iso, gx - 0.16 + sw * 0.03, gy - 0.11, 0.13, 0.2, 5, Math.max(0, sw) * 2.2, pants);
  cube(ctx, iso, gx + 0.03 - sw * 0.03, gy - 0.11, 0.13, 0.2, 5, Math.max(0, -sw) * 2.2, pants);
  if (gear.boots) {
    cube(ctx, iso, gx - 0.17 + sw * 0.03, gy - 0.12, 0.15, 0.22, 2.4, Math.max(0, sw) * 2.2, gear.boots);
    cube(ctx, iso, gx + 0.02 - sw * 0.03, gy - 0.12, 0.15, 0.22, 2.4, Math.max(0, -sw) * 2.2, gear.boots);
  }
  // torso + belt
  cube(ctx, iso, gx - 0.195, gy - 0.145, 0.39, 0.29, 2, 5 + bob, '#2e2318');
  cube(ctx, iso, gx - 0.19, gy - 0.14, 0.38, 0.28, 8, 7 + bob, shirt);
  // arms — swing opposite the legs; working arm raised while gathering
  const armSw = walking ? sw * 0.045 : 0;
  cube(ctx, iso, gx - 0.28 - armSw, gy - 0.1, 0.09, 0.2, 2.5, 5.5 + bob, hands);
  cube(ctx, iso, gx - 0.28 - armSw, gy - 0.1, 0.09, 0.2, 6, 8 + bob, mul(shirt, 0.92));
  if (o.chop) {
    cube(ctx, iso, gx + 0.19, gy - 0.14, 0.09, 0.18, 2.5, 12, hands);
    cube(ctx, iso, gx + 0.19, gy - 0.14, 0.09, 0.18, 5, 9, mul(shirt, 0.92));
    const sp = iso(gx + 0.26, gy - 0.02);
    const tool = o.chop.tool;
    let ang, jab = 0;
    if (tool === 'pick') {
      // mining: big overhead arc slamming down
      ang = -2.15 + (Math.sin(o.chop.ph) + 1) * 0.95;
    } else if (tool === 'pitchfork') {
      // hay: forward-down digging jabs
      ang = 0.5;
      jab = Math.max(0, Math.sin(o.chop.ph)) * 5.5;
    } else {
      // axe: chopping swing
      ang = -1.55 + (Math.sin(o.chop.ph) + 1) * 0.62;
    }
    toolDraw(ctx, sp.x + 2, sp.y - 13, ang, tool, jab);
  } else {
    cube(ctx, iso, gx + 0.19 + armSw, gy - 0.1, 0.09, 0.2, 2.5, 5.5 + bob, hands);
    cube(ctx, iso, gx + 0.19 + armSw, gy - 0.1, 0.09, 0.2, 6, 8 + bob, mul(shirt, 0.92));
  }
  // head
  cube(ctx, iso, gx - 0.14, gy - 0.11, 0.28, 0.22, 8, 15 + bob, skin);
  // eyes on front (+y) face
  const fc = iso(gx, gy + 0.11);
  ctx.fillStyle = '#241608';
  ctx.fillRect(fc.x - 4, fc.y - 20 - bob, 2.2, 3);
  ctx.fillRect(fc.x + 2, fc.y - 20 - bob, 2.2, 3);
  if (gear.hat) { // worn hat — brim, then crown
    cube(ctx, iso, gx - 0.23, gy - 0.19, 0.46, 0.38, 1.8, 22.4 + bob, gear.hat);
    cube(ctx, iso, gx - 0.12, gy - 0.1, 0.24, 0.2, 3.6, 24.2 + bob, mul(gear.hat, 0.88));
  } else { // plain hair (seeded by name so it doesn't flicker while walking)
    const seed = o.name ? o.name.length : 1;
    const hairC = isMe ? '#3a2a1a' : ['#3a2a1a', '#241608', '#5e4527', '#1d1a17'][seed % 4];
    cube(ctx, iso, gx - 0.145, gy - 0.115, 0.29, 0.23, 2.8, 23 + bob, o.hair || hairC);
  }
  if (o.flip) ctx.restore();
  const txt = isMe ? (o.label || 'You') : ('Lvl ' + (o.lvl || 1) + ' ' + (o.name || ''));
  label(ctx, iso, gx, gy, txt, 42, isMe ? '#f2b23a' : '#fff');
}

function bull(ctx, iso, o, t) {
  const gx = o.x, gy = o.y, c = o.coat || '#6e4526';
  const belly = mix(c, '#e8d9b8', 0.3);
  const ph = o.ph || 0;
  const moving = !!o.moving;
  const amp = o.run ? 1.7 : 1;
  const s1 = moving ? Math.sin(ph) : 0;
  const bob = moving ? Math.abs(Math.cos(ph)) * 1.3 * amp : 0;
  const hb = bob + (moving ? Math.sin(ph + 0.6) * 0.9 * amp : 0);
  const swish = Math.sin((t || 0) * 2.2 + gx * 2) * 0.05;
  shadow(ctx, iso, gx, gy, 16, 7);
  const anchor = iso(gx, gy);
  if (o.flip) { ctx.save(); ctx.translate(2 * anchor.x, 0); ctx.scale(-1, 1); }
  // tail FIRST — it hangs off the rear (-x) so the body must paint over its root
  cube(ctx, iso, gx - 0.56, gy - 0.04 + swish, 0.08, 0.08, 5, 9 + bob, mul(c, 0.85));
  cube(ctx, iso, gx - 0.58, gy - 0.05 + swish * 2, 0.1, 0.1, 3, 6 + bob, '#241608');
  // legs — diagonal pairs lift alternately (walk) / faster+higher (run)
  const liftA = moving ? Math.max(0, s1) * 2.6 * amp : 0;
  const liftB = moving ? Math.max(0, -s1) * 2.6 * amp : 0;
  const leg = (lx, ly, lift) => {
    cube(ctx, iso, lx, ly, 0.13, 0.13, 2, lift, '#2b2118');
    cube(ctx, iso, lx, ly, 0.13, 0.13, 3.5, 2 + lift, mul(c, 0.8));
  };
  leg(gx + 0.26, gy - 0.2, liftA); leg(gx - 0.42, gy + 0.07, liftA);
  leg(gx + 0.26, gy + 0.07, liftB); leg(gx - 0.42, gy - 0.2, liftB);
  // hindquarters (drawn first so the body paints over its seam) + belly + body
  cube(ctx, iso, gx - 0.5, gy - 0.22, 0.3, 0.44, 9, 6 + bob, mul(c, 0.94));
  cube(ctx, iso, gx - 0.46, gy - 0.2, 0.92, 0.4, 2.5, 4 + bob, belly);
  cube(ctx, iso, gx - 0.48, gy - 0.24, 0.96, 0.48, 10, 5.5 + bob, c);
  // shoulder hump
  cube(ctx, iso, gx + 0.04, gy - 0.2, 0.3, 0.4, 3, 15.5 + bob, c);
  // head (extra bob out of phase with the body)
  cube(ctx, iso, gx + 0.42, gy - 0.19, 0.34, 0.38, 9, 8 + hb, c);
  // forehead tuft
  cube(ctx, iso, gx + 0.44, gy - 0.15, 0.28, 0.3, 1.6, 17 + hb, mul(c, 0.85));
  // snout
  cube(ctx, iso, gx + 0.72, gy - 0.13, 0.17, 0.26, 5, 8 + hb, '#d8b58a');
  // eyes + nostrils — decals that follow the head/snout front (+x) faces
  decal(ctx, iso, gx + 0.761, gy - 0.15, 0.09, 'y', 13.5 + hb, 1.9, '#17100a');
  decal(ctx, iso, gx + 0.761, gy + 0.06, 0.09, 'y', 13.5 + hb, 1.9, '#17100a');
  decal(ctx, iso, gx + 0.891, gy - 0.095, 0.055, 'y', 9.6 + hb, 1.5, '#3a2a1a');
  decal(ctx, iso, gx + 0.891, gy + 0.04, 0.055, 'y', 9.6 + hb, 1.5, '#3a2a1a');
  // ears
  cube(ctx, iso, gx + 0.44, gy - 0.32, 0.1, 0.1, 2.2, 14 + hb, mul(c, 0.85));
  cube(ctx, iso, gx + 0.44, gy + 0.22, 0.1, 0.1, 2.2, 14 + hb, mul(c, 0.85));
  // horns
  cube(ctx, iso, gx + 0.5, gy - 0.36, 0.08, 0.12, 2, 15.5 + hb, '#efe8d8');
  cube(ctx, iso, gx + 0.52, gy - 0.4, 0.06, 0.07, 3.5, 16.5 + hb, '#f5efe2');
  cube(ctx, iso, gx + 0.5, gy + 0.24, 0.08, 0.12, 2, 15.5 + hb, '#efe8d8');
  cube(ctx, iso, gx + 0.52, gy + 0.33, 0.06, 0.07, 3.5, 16.5 + hb, '#f5efe2');
  // racing blanket
  if (o.racing) {
    cube(ctx, iso, gx - 0.18, gy - 0.26, 0.38, 0.52, 2, 15.7 + bob, '#f2b23a');
    cube(ctx, iso, gx - 0.16, gy - 0.27, 0.34, 0.54, 0.8, 15.4 + bob, '#8e3b2e');
  }
  if (o.flip) ctx.restore();
  if (o.label) label(ctx, iso, gx, gy, o.label, 38, '#fff');
}

/* ================= general store + daily wheel ================= */
function store(ctx, iso, o, t) {
  const gx = o.x, gy = o.y;
  shadow(ctx, iso, gx, gy + 0.4, 44, 18);
  // stone footing + cream walls with timber posts
  cube(ctx, iso, gx - 1.05, gy - 1.05, 2.1, 2.1, 6, 0, '#9a9182');
  cube(ctx, iso, gx - 1, gy - 1, 2, 2, 20, 6, '#ead9b0');
  for (const [px, py] of [[-1.02, -1.02], [0.92, -1.02], [-1.02, 0.92], [0.92, 0.92]]) {
    cube(ctx, iso, gx + px, gy + py, 0.1, 0.1, 20, 6, '#6b4a33');
  }
  const FY = gy + 1.001;
  // door + step
  decal(ctx, iso, gx - 0.25, FY, 0.5, 'x', 6, 15, '#5e3d26');
  decalFrame(ctx, iso, gx - 0.25, FY, 0.5, 'x', 6, 15, '#41291a', 1.6);
  cube(ctx, iso, gx - 0.27, gy + 1.0, 0.54, 0.2, 2, 0, '#9a9182');
  // shop windows either side
  decal(ctx, iso, gx - 0.85, FY, 0.45, 'x', 9, 8, '#bfe3ef');
  decalFrame(ctx, iso, gx - 0.85, FY, 0.45, 'x', 9, 8, '#6b4a33', 1.5);
  decal(ctx, iso, gx + 0.4, FY, 0.45, 'x', 9, 8, '#bfe3ef');
  decalFrame(ctx, iso, gx + 0.4, FY, 0.45, 'x', 9, 8, '#6b4a33', 1.5);
  // striped awning across the front
  for (let i = 0; i < 4; i++) {
    decal(ctx, iso, gx - 1 + i * 0.5, FY, 0.5, 'x', 19, 4, i % 2 ? '#e8e0cc' : '#3f7d4e');
  }
  // roof tiers (green — distinct from homes)
  cube(ctx, iso, gx - 1.22, gy - 1.22, 2.44, 2.44, 5, 26, '#3f6e46');
  cube(ctx, iso, gx - 0.92, gy - 0.92, 1.84, 1.84, 5, 31, '#498052');
  cube(ctx, iso, gx - 0.52, gy - 0.52, 1.04, 1.04, 4.5, 36, '#549260');
  // chimney
  cube(ctx, iso, gx + 0.42, gy - 0.72, 0.32, 0.32, 11, 34, '#8a8078');
  const ch = iso(gx + 0.58, gy - 0.56);
  smoke(ctx, ch.x, ch.y - 46, t || 0, 0.35);
  if (o.label) label(ctx, iso, gx, gy, o.label, 52, '#7dc24f');
}

function wheelObj(ctx, iso, o, t) {
  const gx = o.x, gy = o.y;
  const s = iso(gx, gy);
  shadow(ctx, iso, gx, gy, 14, 6);
  // post + base
  cube(ctx, iso, gx - 0.22, gy - 0.16, 0.44, 0.32, 3, 0, '#6b4a33');
  cube(ctx, iso, gx - 0.07, gy - 0.07, 0.14, 0.14, 26, 3, '#8a6538');
  // wheel disc — slow idle turn
  const cy0 = s.y - 44, R = 15;
  const rot = ((t || 0) * 0.5) % (Math.PI * 2);
  const cols = ['#c9573f', '#e8e0cc', '#f2b23a', '#3b6ea5', '#7dc24f', '#c86ad4', '#e07840', '#5fb4d8'];
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = cols[i];
    ctx.beginPath();
    ctx.moveTo(s.x, cy0);
    ctx.arc(s.x, cy0, R, rot + (i * Math.PI) / 4, rot + ((i + 1) * Math.PI) / 4);
    ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = '#41291a'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(s.x, cy0, R, 0, 7); ctx.stroke();
  ctx.fillStyle = '#f2b23a';
  ctx.beginPath(); ctx.arc(s.x, cy0, 3, 0, 7); ctx.fill();
  // pointer
  ctx.fillStyle = '#e8e0cc';
  ctx.beginPath();
  ctx.moveTo(s.x - 4, cy0 - R - 6); ctx.lineTo(s.x + 4, cy0 - R - 6); ctx.lineTo(s.x, cy0 - R + 2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#41291a'; ctx.lineWidth = 1.4; ctx.stroke();
  if (o.label) label(ctx, iso, gx, gy, o.label, 66, '#f2c94c');
}

/* ================= equippable item assets ================= */
const RARC = { Common: '#c9b896', Uncommon: '#7dc24f', Rare: '#5fb4d8', Epic: '#c86ad4', Legendary: '#f2b23a' };
function drawItem(ctx, iso, slot, rarity, color) {
  const acc = RARC[rarity] || '#c9b896';
  const main = color || acc;
  if (slot === 'hat') { // wide-brim hat
    shadow(ctx, iso, 0, 0, 13, 5.5);
    cube(ctx, iso, -0.4, -0.34, 0.8, 0.68, 2.2, 2, main);
    cube(ctx, iso, -0.2, -0.17, 0.4, 0.34, 5.5, 4.2, mul(main, 0.88));
    decal(ctx, iso, -0.2, 0.171, 0.4, 'x', 4.2, 1.6, acc);
  } else if (slot === 'outfit') { // folded shirt with collar
    shadow(ctx, iso, 0, 0, 13, 5.5);
    cube(ctx, iso, -0.35, -0.26, 0.7, 0.52, 4.5, 0, main);
    cube(ctx, iso, -0.3, -0.21, 0.6, 0.42, 3.5, 4.5, mul(main, 0.9));
    cube(ctx, iso, -0.12, -0.1, 0.24, 0.2, 1.8, 8, '#efe8d8');
    decal(ctx, iso, -0.3, 0.261, 0.6, 'x', 1.2, 1.2, acc);
  } else if (slot === 'boots') { // pair of boots
    shadow(ctx, iso, 0, 0, 13, 5.5);
    const boot = (x) => {
      cube(ctx, iso, x, -0.1, 0.16, 0.2, 6.5, 0, main);
      cube(ctx, iso, x, 0.08, 0.17, 0.14, 2.4, 0, mul(main, 0.8));
      cube(ctx, iso, x - 0.01, -0.11, 0.18, 0.22, 1.4, 6.5, acc);
    };
    boot(-0.26); boot(0.08);
  } else if (slot === 'gloves') { // pair of mitts
    shadow(ctx, iso, 0, 0, 12, 5);
    const mitt = (x) => {
      cube(ctx, iso, x, -0.08, 0.18, 0.18, 4.5, 0, main);
      cube(ctx, iso, x + 0.13, 0.02, 0.07, 0.09, 2.6, 2, main);
      cube(ctx, iso, x - 0.01, -0.09, 0.2, 0.2, 1.2, 4.5, acc);
    };
    mitt(-0.28); mitt(0.08);
  } else if (slot === 'coat') { // folded blanket stack
    shadow(ctx, iso, 0, 0, 14, 6);
    cube(ctx, iso, -0.35, -0.28, 0.7, 0.56, 5, 0, acc);
    cube(ctx, iso, -0.3, -0.23, 0.6, 0.46, 4, 5, mul(acc, 0.85));
    cube(ctx, iso, -0.32, -0.25, 0.64, 0.5, 1.5, 9, mix(acc, '#ffffff', 0.25));
    decal(ctx, iso, -0.3, 0.281, 0.6, 'x', 1.5, 1, 'rgba(23,16,10,.35)');
  } else if (slot === 'horns') { // horn pair on a display stand
    shadow(ctx, iso, 0, 0, 13, 5.5);
    cube(ctx, iso, -0.3, -0.18, 0.6, 0.36, 4, 0, '#6f5432');
    decal(ctx, iso, -0.3, 0.181, 0.6, 'x', 0.8, 2.2, acc);
    cube(ctx, iso, -0.26, -0.1, 0.12, 0.16, 3, 4, '#efe8d8');
    cube(ctx, iso, -0.24, -0.08, 0.09, 0.1, 6, 7, '#f5efe2');
    cube(ctx, iso, 0.14, -0.1, 0.12, 0.16, 3, 4, '#efe8d8');
    cube(ctx, iso, 0.15, -0.08, 0.09, 0.1, 6, 7, '#f5efe2');
  } else if (slot === 'hooves') { // four hoof caps
    shadow(ctx, iso, 0, 0, 14, 6);
    const cap = (x, y) => {
      cube(ctx, iso, x, y, 0.16, 0.16, 3, 0, '#2b2118');
      cube(ctx, iso, x, y, 0.16, 0.16, 1.6, 3, acc);
    };
    cap(-0.3, -0.22); cap(0.1, -0.22); cap(-0.3, 0.1); cap(0.1, 0.1);
  } else if (slot === 'tail') { // coiled tail wrap + tuft
    shadow(ctx, iso, 0, 0, 12, 5);
    const s = iso(0, 0);
    ctx.strokeStyle = mul(acc, 0.9); ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(s.x, s.y - 6, 10, 6, 0, 0, 7); ctx.stroke();
    ctx.strokeStyle = mix(acc, '#ffffff', 0.3); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(s.x, s.y - 6, 10, 6, 0, 0.6, 2.4); ctx.stroke();
    cube(ctx, iso, 0.22, 0.1, 0.1, 0.1, 4, 0, '#241608');
  } else { // accessory / harness — saddle on a rail stand
    shadow(ctx, iso, 0, 0, 14, 6);
    cube(ctx, iso, -0.05, -0.3, 0.12, 0.6, 8, 0, '#6f5432');
    cube(ctx, iso, -0.28, -0.32, 0.56, 0.64, 3.2, 8, '#8e3b2e');
    cube(ctx, iso, -0.22, -0.34, 0.44, 0.68, 1.4, 7.2, acc);
    cube(ctx, iso, -0.3, -0.12, 0.6, 0.24, 4.5, 10.5, mul('#8e3b2e', 1.1));
  }
}

function drawObj(ctx, iso, o, opts) {
  opts = opts || {};
  const t = opts.t || 0, nowMs = opts.nowMs || 0;
  const dead = !!(o.dead && o.dead > nowMs);
  switch (o.t) {
    case 'tree': return tree(ctx, iso, o, dead);
    case 'rock': return ore(ctx, iso, o, dead, t);
    case 'hay': return hay(ctx, iso, o, dead);
    case 'house': return house(ctx, iso, o, t);
    case 'stable': return stable(ctx, iso, o, opts);
    case 'booth': return booth(ctx, iso, o);
    case 'market': return market(ctx, iso, o);
    case 'forge': return forge(ctx, iso, o, t);
    case 'racebooth': return racebooth(ctx, iso, o, t);
    case 'sign': return sign(ctx, iso, o);
    case 'store': return store(ctx, iso, o, t);
    case 'wheel': return wheelObj(ctx, iso, o, t);
    case 'post': return post(ctx, iso, o);
    case 'rail': return rail(ctx, iso, o);
    case 'bridge': return bridge(ctx, iso, o);
    case 'player': case 'npc': return person(ctx, iso, o);
    case 'bull': return bull(ctx, iso, o, t);
  }
}

export const BRArt = { iso: iso0, hash, mul, mix, cube, decal, decalFrame, decalCorners, faceLine, diamond, shadow, label, tile, drawObj, drawItem, RARC, TW, TH };
