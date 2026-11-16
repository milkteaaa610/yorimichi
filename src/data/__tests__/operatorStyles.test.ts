/**
 * 駅ナンバリングの表示スタイル。16社分のバッジの形・色・書体をスナップショットで守る。
 * 表（OPERATOR_STYLES）を1行変えると、このスナップショットが変わる＝全画面のバッジが変わる。
 */
import { BADGE_FONTS, OPERATOR_STYLES, badgeLayout, resolveBadgeStyle } from '../operatorStyles';

/** デザインキャンバスの「駅ナンバリングの表示スタイル」と同じ16社 */
const SAMPLES = [
  { code: 'JY', color: '#80C241', op: 'JR東日本' },
  { code: 'TS', color: '#1F3E8E', op: '東武鉄道' },
  { code: 'OH', color: '#1E7FCB', op: '小田急電鉄' },
  { code: 'KK', color: '#00A0DE', ink: '#1D2C7A', op: '京急電鉄' },
  { code: 'TR', color: '#3BA03C', op: '東葉高速鉄道' },
  { code: 'KS', color: '#005BAC', op: '京成電鉄' },
  { code: 'R', color: '#3E2A87', op: 'りんかい線' },
  { code: 'KO', color: '#DD0077', op: '京王電鉄' },
  { code: 'TY', color: '#DA0442', op: '東急電鉄' },
  { code: 'B', color: '#0070C0', op: '横浜市営地下鉄' },
  { code: 'G', color: '#FF9500', op: '東京メトロ' },
  { code: 'A', color: '#E85298', op: '都営地下鉄' },
  { code: 'SI', color: '#F08300', op: '西武鉄道' },
  { code: 'SR', color: '#2F5DA8', op: '埼玉高速鉄道' },
  { code: 'U', color: '#1B5FAA', op: 'ゆりかもめ' },
  { code: 'SO', color: '#1D3B8B', op: '相模鉄道' },
];

test.each(SAMPLES)('$op（$code）', ({ code, color, ink }) => {
  const style = resolveBadgeStyle(code);
  const layout = badgeLayout({ code, num: '01', color, ink, size: 64, ...style });
  expect({ style, layout }).toMatchSnapshot();
});

test('16社がそれぞれ表の行に当たる（既定の形に落ちない）', () => {
  for (const s of SAMPLES) {
    expect(OPERATOR_STYLES.some((r) => r.codes.test(s.code))).toBe(true);
  }
});

test('駅データ側で形と書体を上書きできる（横浜市営地下鉄グリーンラインの G など）', () => {
  expect(resolveBadgeStyle('G')).toEqual({ shape: 'circle', face: 'futura' });
  expect(resolveBadgeStyle('G', { shape: 'circle-fill', face: 'myriad' })).toEqual({ shape: 'circle-fill', face: 'myriad' });
  // 不正な値は無視して、表のとおりにする
  expect(resolveBadgeStyle('G', { shape: 'star', face: 'comic' })).toEqual({ shape: 'circle', face: 'futura' });
});

test('表にない事業者は角・枠、アプリの書体', () => {
  expect(resolveBadgeStyle('ZZ')).toEqual({ shape: 'square', face: 'app' });
});

test('番号のないバッジ（路線一覧）は記号だけを大きく出す', () => {
  const l = badgeLayout({ code: 'JY', num: '', color: '#80C241', size: 40, shape: 'square', face: 'frutiger' });
  expect(l.hasNum).toBe(false);
  expect(l.codeSize).toBeGreaterThan(badgeLayout({ code: 'JY', num: '01', color: '#80C241', size: 40, shape: 'square', face: 'frutiger' }).codeSize);
});

test('すべての書体にアプリで読み込む名前がある', () => {
  for (const f of Object.values(BADGE_FONTS)) expect(f.family).toMatch(/_\d{3}/);
});
