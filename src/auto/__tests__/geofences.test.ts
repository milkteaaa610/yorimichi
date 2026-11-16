import { OUTER_ID, parseRegionId, planGeofences, stationRegionId } from '../geofences';

const nearby = (lat: number, lng: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({
    station: { id: i + 1, lat: lat + i * 0.001, lng, underground: i % 5 === 0 },
    distance: (i + 1) * 100,
  }));

describe('planGeofences', () => {
  test('iPhone は19駅＋外枠1つ', () => {
    const r = planGeofences({ lat: 35, lng: 139, platform: 'ios', nearby, excluded: new Set() });
    expect(r).toHaveLength(20);
    expect(r.filter((x) => x.identifier === OUTER_ID)).toHaveLength(1);
  });

  test('Android は99駅＋外枠1つ', () => {
    const r = planGeofences({ lat: 35, lng: 139, platform: 'android', nearby, excluded: new Set() });
    expect(r).toHaveLength(100);
  });

  test('除外する駅は見張らず、その分ほかの駅を入れる', () => {
    const r = planGeofences({ lat: 35, lng: 139, platform: 'ios', nearby, excluded: new Set([1, 2]) });
    expect(r).toHaveLength(20);
    expect(r.map((x) => x.identifier)).not.toContain(stationRegionId(1));
  });

  test('地下駅の円は広い', () => {
    const r = planGeofences({ lat: 35, lng: 139, platform: 'ios', nearby, excluded: new Set() });
    const under = r.find((x) => x.identifier === stationRegionId(1))!;
    const ground = r.find((x) => x.identifier === stationRegionId(2))!;
    expect(under.radius).toBeGreaterThan(ground.radius);
  });

  test('外枠は抜けたときだけ知らせる', () => {
    const r = planGeofences({ lat: 35, lng: 139, platform: 'ios', nearby, excluded: new Set() });
    const outer = r.find((x) => x.identifier === OUTER_ID)!;
    expect(outer).toMatchObject({ notifyOnEnter: false, notifyOnExit: true, latitude: 35, longitude: 139 });
  });

  test('IDの読み取り', () => {
    expect(parseRegionId('station:42')).toBe(42);
    expect(parseRegionId(OUTER_ID)).toBe('outer');
    expect(parseRegionId('other')).toBeNull();
  });
});
