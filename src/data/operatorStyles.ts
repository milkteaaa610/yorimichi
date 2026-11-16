/**
 * 駅ナンバリングの表示スタイル表。
 *
 * 形・書体はここだけで決める。路線記号から鉄道会社を判定し、会社ごとの形と書体を選ぶ。
 * 公式の仕様が手に入ったら、この表を差し替えるだけで全画面のバッジに反映される。
 * 色は路線ごとなので、駅マスタ（data/numbering/lines.csv）で持つ。
 */

/** バッジの形。枠＝色の枠に黒文字、色文字＝枠と文字が路線色、上帯＝上半分を塗る、塗り＝全面を塗る。 */
export type BadgeShape =
  | 'square'
  | 'square-text'
  | 'square-top'
  | 'square-fill'
  | 'circle'
  | 'circle-text'
  | 'circle-top'
  | 'circle-fill';

/** 各社が公式に使っている書体。実際に表示する書体は BADGE_FONTS で置き換える。 */
export type BadgeFace =
  | 'frutiger'
  | 'din'
  | 'shingo'
  | 'myriad'
  | 'futura'
  | 'helvetica'
  | 'eras'
  | 'rotis'
  | 'app';

export type OperatorStyle = {
  /** 事業者名（表示スタイル表の見出し用） */
  operator: string;
  /** この事業者の路線記号 */
  codes: RegExp;
  shape: BadgeShape;
  face: BadgeFace;
};

/** 上から順に見て、最初に路線記号が合った行を使う。 */
export const OPERATOR_STYLES: OperatorStyle[] = [
  { operator: 'JR東日本', codes: /^J[A-Z]$/, shape: 'square', face: 'frutiger' },
  { operator: 'JR西日本', codes: /^JR-[A-Z]$/, shape: 'square', face: 'frutiger' }, // 仮
  { operator: '東武鉄道', codes: /^T[SIJDN]$/, shape: 'square', face: 'frutiger' },
  { operator: '小田急電鉄', codes: /^O[HET]$/, shape: 'square-text', face: 'frutiger' },
  { operator: '京急電鉄', codes: /^KK$/, shape: 'circle-text', face: 'frutiger' },
  { operator: '東葉高速鉄道', codes: /^TR$/, shape: 'circle', face: 'frutiger' },
  { operator: '京成電鉄', codes: /^KS$/, shape: 'circle-text', face: 'din' },
  { operator: 'りんかい線', codes: /^R$/, shape: 'circle-fill', face: 'din' },
  { operator: '京王電鉄', codes: /^(KO|IN)$/, shape: 'circle-top', face: 'shingo' },
  { operator: '東急電鉄', codes: /^(TY|DT|OM|MG|IK|TM|SG|KD|SH)$/, shape: 'square-top', face: 'myriad' },
  { operator: '横浜市営地下鉄', codes: /^B$/, shape: 'circle-fill', face: 'myriad' },
  { operator: '西武鉄道', codes: /^(SI|SS|SY|SK|SW|ST|SM)$/, shape: 'square-top', face: 'helvetica' },
  { operator: '埼玉高速鉄道', codes: /^SR$/, shape: 'circle', face: 'helvetica' },
  { operator: 'ゆりかもめ', codes: /^U$/, shape: 'circle-fill', face: 'eras' },
  { operator: '相模鉄道', codes: /^SO$/, shape: 'square-fill', face: 'rotis' },
  { operator: '東京メトロ・都営地下鉄', codes: /^(G|M|Mb|H|T|C|Y|Z|N|F|A|I|S|E)$/, shape: 'circle', face: 'futura' },
  { operator: '江ノ島電鉄', codes: /^EN$/, shape: 'square', face: 'frutiger' }, // 仮
  { operator: '京都市営地下鉄', codes: /^K$/, shape: 'circle', face: 'futura' }, // 仮
];

/** 表にない事業者の形と書体。 */
export const DEFAULT_STYLE: { shape: BadgeShape; face: BadgeFace } = { shape: 'square', face: 'app' };

/** 公式書体 → 表示に使う書体（アプリに同梱している近い書体）。 */
export const BADGE_FONTS: Record<BadgeFace, { family: string; label: string; official: string }> = {
  frutiger: { family: 'Hind_700Bold', label: 'Hind', official: 'Frutiger' },
  din: { family: 'Barlow_700Bold', label: 'Barlow', official: 'DIN' },
  shingo: { family: 'MPLUS1p_700Bold', label: 'M PLUS 1p', official: '新ゴ' },
  myriad: { family: 'SourceSans3_700Bold', label: 'Source Sans 3', official: 'Myriad' },
  futura: { family: 'Jost_600SemiBold', label: 'Jost', official: 'Futura' },
  helvetica: { family: 'Inter_700Bold', label: 'Inter', official: 'Helvetica' },
  eras: { family: 'Geologica_700Bold', label: 'Geologica', official: 'Eras' },
  rotis: { family: 'Geologica_700Bold', label: 'Geologica', official: 'Rotis' },
  app: { family: 'Geologica_700Bold', label: 'Geologica', official: '' },
};

const SHAPES: readonly string[] = [
  'square', 'square-text', 'square-top', 'square-fill',
  'circle', 'circle-text', 'circle-top', 'circle-fill',
];

export function isBadgeShape(v: string | null | undefined): v is BadgeShape {
  return typeof v === 'string' && SHAPES.includes(v);
}

export function isBadgeFace(v: string | null | undefined): v is BadgeFace {
  return typeof v === 'string' && v in BADGE_FONTS;
}

/**
 * 路線記号から形と書体を決める。
 * override は駅データ側（operators.badge_style / badge_font）の上書きで、
 * 路線記号が他社と重なる事業者（横浜市営地下鉄のグリーンライン G など）に使う。
 */
export function resolveBadgeStyle(
  code: string,
  override?: { shape?: string | null; face?: string | null },
): { shape: BadgeShape; face: BadgeFace } {
  const rule = OPERATOR_STYLES.find((r) => r.codes.test(code));
  return {
    shape: isBadgeShape(override?.shape) ? override.shape : (rule?.shape ?? DEFAULT_STYLE.shape),
    face: isBadgeFace(override?.face) ? override.face : (rule?.face ?? DEFAULT_STYLE.face),
  };
}

/** バッジを描くための寸法と色。NumberingBadge はこの値をそのまま置くだけ。 */
export type BadgeLayout = {
  size: number;
  radius: number;
  borderWidth: number;
  borderColor: string;
  background: string;
  fontFamily: string;
  hasNum: boolean;
  /** 上段（路線記号）の高さ。番号がなければ全体 */
  topHeight: number;
  topBackground: string;
  codeColor: string;
  codeSize: number;
  codeAlign: 'center' | 'flex-end';
  codePadBottom: number;
  numColor: string;
  numSize: number;
  separator: { height: number; margin: number } | null;
};

const INK = '#18181B';
const WHITE = '#FFFFFF';
const round1 = (n: number) => Math.round(n * 10) / 10;

export function badgeLayout(input: {
  code: string;
  num: string;
  color: string;
  ink?: string | null;
  size: number;
  shape: BadgeShape;
  face: BadgeFace;
}): BadgeLayout {
  const { code, num, color, shape } = input;
  const S = input.size;
  const ink = input.ink || color;
  const hasNum = num !== '';

  let codeSize = hasNum ? Math.max(7, S * 0.24) : Math.max(9, S * 0.38);
  if (code.length > 2) codeSize *= 0.78;
  const numSize = Math.max(10, S * 0.42);

  let radius = S * 0.16;
  let borderWidth = Math.max(2, S * 0.1);
  let background = WHITE;
  let topBackground = 'transparent';
  let codeColor = INK;
  let numColor = INK;
  let topRatio = 0.42;
  let codeAlign: 'center' | 'flex-end' = hasNum ? 'flex-end' : 'center';
  let codePadBottom = hasNum ? S * 0.015 : 0;
  let separator: BadgeLayout['separator'] = null;

  switch (shape) {
    case 'square':
      break;
    case 'square-text':
      radius = S * 0.3;
      codeColor = ink;
      numColor = ink;
      break;
    case 'circle':
      radius = S / 2;
      borderWidth = Math.max(2, S * 0.12);
      break;
    case 'circle-text':
      radius = S / 2;
      borderWidth = Math.max(2, S * 0.08);
      codeColor = ink;
      numColor = ink;
      break;
    case 'circle-top':
    case 'square-top': {
      const circle = shape === 'circle-top';
      radius = circle ? S / 2 : S * 0.16;
      borderWidth = Math.max(2, S * (circle ? 0.06 : 0.08));
      if (hasNum) {
        topBackground = color;
        codeColor = WHITE;
        topRatio = 0.46;
        codeAlign = circle ? 'flex-end' : 'center';
        codePadBottom = circle ? S * 0.045 : 0;
      } else {
        background = color;
        codeColor = WHITE;
      }
      break;
    }
    case 'square-fill':
    case 'circle-fill':
      radius = shape === 'circle-fill' ? S / 2 : S * 0.16;
      borderWidth = 0;
      background = color;
      codeColor = WHITE;
      numColor = WHITE;
      if (shape === 'square-fill' && hasNum) {
        separator = { height: round1(Math.max(1, S * 0.03)), margin: round1(S * 0.16) };
        codePadBottom = S * 0.04;
      }
      break;
  }

  const inner = S - borderWidth * 2;
  return {
    size: S,
    radius: round1(radius),
    borderWidth: round1(borderWidth),
    borderColor: color,
    background,
    fontFamily: BADGE_FONTS[input.face].family,
    hasNum,
    topHeight: round1(hasNum ? inner * topRatio : inner),
    topBackground,
    codeColor,
    codeSize: round1(codeSize),
    codeAlign,
    codePadBottom: round1(codePadBottom),
    numColor,
    numSize: round1(numSize),
    separator,
  };
}
