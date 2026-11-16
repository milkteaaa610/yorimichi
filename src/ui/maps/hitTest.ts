/**
 * 地図のどこをタップしたかを調べる。
 *
 * SVG の図形ごとにタップを受けると、Web で動かなかったり、図形が多いと重くなったりするので、
 * 地図全体で1回だけタップを受け、その位置がどの地域の中かを自分で計算する。
 * パスは scripts/build-master が書き出す「M x y L x y … Z」だけの形を前提にする。
 */
import type { Region } from './RegionMap';

type Ring = Float64Array; // x0, y0, x1, y1, …

type Shape = { id: string; rings: Ring[]; bbox: [number, number, number, number] };

export function parsePath(d: string): Ring[] {
  const rings: Ring[] = [];
  for (const part of d.split('Z')) {
    const nums = part.match(/-?\d+(?:\.\d+)?/g);
    if (!nums || nums.length < 6) continue;
    rings.push(Float64Array.from(nums, Number));
  }
  return rings;
}

function inRing(x: number, y: number, r: Ring): boolean {
  let inside = false;
  const n = r.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = r[i * 2];
    const yi = r[i * 2 + 1];
    const xj = r[j * 2];
    const yj = r[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToRing(x: number, y: number, r: Ring): number {
  let best = Infinity;
  const n = r.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const ax = r[j * 2];
    const ay = r[j * 2 + 1];
    const bx = r[i * 2];
    const by = r[i * 2 + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len));
    const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
    if (d < best) best = d;
  }
  return best;
}

export class RegionIndex {
  private shapes: Shape[];

  constructor(regions: Region[]) {
    this.shapes = regions.map((r) => {
      const rings = parsePath(r.d);
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const ring of rings) {
        for (let i = 0; i < ring.length; i += 2) {
          x0 = Math.min(x0, ring[i]);
          x1 = Math.max(x1, ring[i]);
          y0 = Math.min(y0, ring[i + 1]);
          y1 = Math.max(y1, ring[i + 1]);
        }
      }
      return { id: r.id, rings, bbox: [x0, y0, x1, y1] };
    });
  }

  /**
   * (x, y) を含む地域。どこにも入っていなければ、tolerance 以内でいちばん近い地域
   * （小さな島や細い県を指で押しやすくするため）。
   */
  hit(x: number, y: number, tolerance = 0): string | null {
    let near: { id: string; d: number } | null = null;
    for (const s of this.shapes) {
      const [x0, y0, x1, y1] = s.bbox;
      if (x < x0 - tolerance || x > x1 + tolerance || y < y0 - tolerance || y > y1 + tolerance) continue;
      // 偶奇規則：穴（飛び地を囲む輪）も正しく扱える
      let inside = false;
      for (const r of s.rings) if (inRing(x, y, r)) inside = !inside;
      if (inside) return s.id;
      if (tolerance > 0) {
        for (const r of s.rings) {
          const d = distToRing(x, y, r);
          if (d <= tolerance && (!near || d < near.d)) near = { id: s.id, d };
        }
      }
    }
    return near?.id ?? null;
  }
}
