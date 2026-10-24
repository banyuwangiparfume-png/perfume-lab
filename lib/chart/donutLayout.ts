/**
 * Tata letak donat berlabel: irisan, dan label di luar dengan garis penunjuk.
 *
 * Ditulis sendiri, bukan label bawaan library chart, karena label bawaan
 * diletakkan per irisan tanpa tahu label lain — dua irisan kecil yang
 * bersebelahan menumpuk labelnya. Di sini label tiap sisi diurutkan lalu
 * didorong supaya berjarak minimal satu baris, dan garisnya ikut menekuk ke
 * posisi barunya.
 */

export type DonutInput = { key: string; value: number };

export type DonutSlice = {
  key: string;
  path: string;
  /** garis penunjuk: dari tepi irisan → tekukan → ujung dekat teks */
  leader: [number, number][];
  labelX: number;
  labelY: number;
  anchor: "start" | "end";
};

export type DonutGeometry = {
  width: number;
  height: number;
  cx: number;
  cy: number;
  outer: number;
  inner: number;
  /** jarak minimal antar label, satuan viewBox */
  lineHeight: number;
  /** celah antar irisan, derajat */
  gapDeg: number;
};

export const DEFAULT_GEOMETRY: DonutGeometry = {
  width: 470,
  height: 230,
  cx: 235,
  cy: 115,
  outer: 62,
  inner: 40,
  lineHeight: 15,
  gapDeg: 1.6,
};

const rad = (deg: number) => (deg * Math.PI) / 180;
const pt = (cx: number, cy: number, r: number, deg: number): [number, number] => [
  cx + r * Math.cos(rad(deg)),
  cy + r * Math.sin(rad(deg)),
];
const f = (n: number) => Math.round(n * 100) / 100;

function arcPath(g: DonutGeometry, a0: number, a1: number): string {
  const { cx, cy, outer, inner } = g;
  // Satu irisan penuh tidak bisa digambar sebagai busur 360°; dibelah dua.
  if (a1 - a0 >= 359.99) {
    return [arcPath(g, a0, a0 + 180), arcPath(g, a0 + 180, a0 + 360)].join(" ");
  }
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = pt(cx, cy, outer, a0);
  const [x1, y1] = pt(cx, cy, outer, a1);
  const [x2, y2] = pt(cx, cy, inner, a1);
  const [x3, y3] = pt(cx, cy, inner, a0);
  return [
    `M${f(x0)},${f(y0)}`,
    `A${outer},${outer} 0 ${large} 1 ${f(x1)},${f(y1)}`,
    `L${f(x2)},${f(y2)}`,
    `A${inner},${inner} 0 ${large} 0 ${f(x3)},${f(y3)}`,
    "Z",
  ].join(" ");
}

/**
 * Sebar label satu sisi: urut dari atas, jarak minimal lineHeight, dan
 * semuanya tetap di dalam kotak. Kalau dorongan ke bawah menabrak dasar,
 * seluruh tumpukan digeser naik.
 */
export function spreadLabels(
  desired: number[],
  lineHeight: number,
  top: number,
  bottom: number,
): number[] {
  const order = desired.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const placed = order.map((o) => Math.min(Math.max(o.y, top), bottom));
  for (let k = 1; k < placed.length; k++) {
    placed[k] = Math.max(placed[k], placed[k - 1] + lineHeight);
  }
  const overflow = placed.length ? placed[placed.length - 1] - bottom : 0;
  if (overflow > 0) {
    for (let k = placed.length - 1; k >= 0; k--) {
      placed[k] -= overflow;
      if (k > 0) placed[k - 1] = Math.min(placed[k - 1], placed[k] - lineHeight);
    }
  }
  const out = new Array<number>(desired.length);
  order.forEach((o, k) => (out[o.i] = placed[k]));
  return out;
}

export function donutLayout(
  data: DonutInput[],
  g: DonutGeometry = DEFAULT_GEOMETRY,
): DonutSlice[] {
  const items = data.filter((d) => d.value > 0);
  const total = items.reduce((a, d) => a + d.value, 0);
  if (!total) return [];

  const gap = items.length > 1 ? g.gapDeg : 0;
  // Mulai dari jam 12, searah jarum jam.
  let angle = -90;
  const raw = items.map((d) => {
    const sweep = (d.value / total) * 360;
    const a0 = angle + gap / 2;
    const a1 = angle + sweep - gap / 2;
    angle += sweep;
    const mid = (a0 + a1) / 2;
    const right = Math.cos(rad(mid)) >= 0;
    const [ex, ey] = pt(g.cx, g.cy, g.outer + 2, mid);
    const [bx, by] = pt(g.cx, g.cy, g.outer + 14, mid);
    return { d, a0, a1, mid, right, edge: [ex, ey] as [number, number], bend: [bx, by] as [number, number] };
  });

  const half = g.lineHeight / 2;
  const ys = new Array<number>(raw.length);
  for (const side of [true, false]) {
    const idx = raw.map((r, i) => (r.right === side ? i : -1)).filter((i) => i >= 0);
    const spread = spreadLabels(
      idx.map((i) => raw[i].bend[1]),
      g.lineHeight,
      half + 2,
      g.height - half - 2,
    );
    idx.forEach((i, k) => (ys[i] = spread[k]));
  }

  return raw.map((r, i) => {
    const y = ys[i];
    const tailX = r.right ? g.cx + g.outer + 20 : g.cx - g.outer - 20;
    // Garis ke satu KOLOM tegak per sisi, baru belok ke label. Kolomnya di
    // luar seluruh tepi donat, dan urutan label mengikuti urutan tepi, jadi
    // garis-garisnya tidak bisa bersilangan — beda dengan menekuk di titik
    // radial masing-masing, yang bersilangan begitu label tergeser jauh.
    const colX = r.right ? g.cx + g.outer + 10 : g.cx - g.outer - 10;
    return {
      key: r.d.key,
      path: arcPath(g, r.a0, r.a1),
      leader: [r.edge, [colX, y], [tailX, y]].map(([x, yy]) => [f(x), f(yy)]) as [number, number][],
      labelX: f(r.right ? tailX + 4 : tailX - 4),
      labelY: f(y),
      anchor: r.right ? "start" : "end",
    };
  });
}
