import { clampView, computeViewBox } from '../Zoomable';
import { RegionIndex, parsePath } from '../hitTest';

const square = (id: string, x: number, y: number, s: number) => ({
  id,
  label: id,
  d: `M${x} ${y}L${x + s} ${y}L${x + s} ${y + s}L${x} ${y + s}Z`,
});

test('パスを読む', () => {
  expect(parsePath('M0 0L10 0L10 10Z M20 20L30 20L30 30Z')).toHaveLength(2);
});

test('タップした地域を返し、近くの小さな島は少し外れても拾う', () => {
  const index = new RegionIndex([square('a', 0, 0, 100), square('b', 200, 0, 4)]);
  expect(index.hit(50, 50)).toBe('a');
  expect(index.hit(150, 50)).toBeNull();
  expect(index.hit(198, 2, 5)).toBe('b');
});

test('穴のある地域（飛び地を囲む輪）は、穴の中を含まない', () => {
  const index = new RegionIndex([{ id: 'ring', label: '', d: 'M0 0L100 0L100 100L0 100Z M40 40L60 40L60 60L40 60Z' }]);
  expect(index.hit(10, 10)).toBe('ring');
  expect(index.hit(50, 50)).toBeNull();
});

test('拡大しても地図の外へ行きすぎない', () => {
  const content = { width: 1000, height: 1000 };
  const box = { width: 400, height: 800 };
  const v = clampView(content, box, { scale: 4, cx: -500, cy: 2000 }, 8);
  const vb = computeViewBox(content, box, v);
  expect(vb.x).toBeGreaterThanOrEqual(0);
  expect(vb.y + vb.h).toBeLessThanOrEqual(1000.0001);
  expect(clampView(content, box, { scale: 20, cx: 500, cy: 500 }, 8).scale).toBe(8);
});
