/** 画面全体で使う色と書体。値はデザインキャンバスのもの。 */
export const colors = {
  ink: '#18181B',
  sub: '#6B6B70',
  body: '#45454A',
  mute: '#9A9A9F',
  segmentOff: '#56565B',
  white: '#FFFFFF',
  surface: '#F5F5F4',
  surfaceSoft: '#FAFAF9',
  hairline: '#EDEDEB',
  border: '#E4E4E2',
  borderStrong: '#D4D4D1',
  control: '#BDBDB9',
  switchOff: '#D9D9D6',
  disabled: '#E4E4E2',
  lockScreen: '#23272D',
} as const;

/** 都道府県の塗り（訪れた駅の数で4段階）。 */
export const PREF_LEVELS = [
  { min: 30, bg: '#18181B', fg: '#FFFFFF', label: '30駅〜' },
  { min: 10, bg: '#9C9C97', fg: '#111113', label: '10–29' },
  { min: 1, bg: '#D6D6D2', fg: '#18181B', label: '1–9' },
  { min: 0, bg: '#F0F0EE', fg: '#6B6B70', label: '0' },
] as const;

/** 市区町村の塗り。 */
export const MUNI_LEVELS = [
  { min: 10, bg: '#18181B', fg: '#FFFFFF', sub: '#D4D4D8', label: '10駅〜' },
  { min: 5, bg: '#A9A9A4', fg: '#111113', sub: '#222225', label: '5–9駅' },
  { min: 1, bg: '#E2E2DF', fg: '#18181B', sub: '#45454A', label: '1–4駅' },
  { min: 0, bg: '#F5F5F4', fg: '#6B6B70', sub: '#6B6B70', label: '未訪問' },
] as const;

export function levelFor<T extends { min: number }>(levels: readonly T[], n: number): T {
  return levels.find((l) => n >= l.min) ?? levels[levels.length - 1];
}

export type Weight = 300 | 400 | 500 | 600 | 700;

/** 英数字は Geologica。 */
export const LATIN_FONT: Record<Weight, string> = {
  300: 'Geologica_300Light',
  400: 'Geologica_400Regular',
  500: 'Geologica_500Medium',
  600: 'Geologica_600SemiBold',
  700: 'Geologica_700Bold',
};

/** 日本語は Noto Sans JP（400・500・700 を同梱）。 */
export const JP_FONT: Record<Weight, string> = {
  300: 'NotoSansJP_400Regular',
  400: 'NotoSansJP_400Regular',
  500: 'NotoSansJP_500Medium',
  600: 'NotoSansJP_700Bold',
  700: 'NotoSansJP_700Bold',
};
