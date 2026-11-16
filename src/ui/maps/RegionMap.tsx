/**
 * 地図を描く部品。都道府県の日本地図にも、市区町村の地図にも使う。
 *
 * 形は scripts/build-master が作った SVG のパス（assets/map）で、ここでは色を塗って並べるだけ。
 * 境界線の太さは拡大しても変わらない（non-scaling-stroke）。
 */
import { memo } from 'react';
import Svg, { G, Path } from 'react-native-svg';

import { colors } from '../theme';

export type Region = { id: string; d: string; label: string };

export type ViewBox = { x: number; y: number; w: number; h: number };

type Props = {
  width: number;
  height: number;
  regions: Region[];
  /** 地域ごとの塗り。null を返した地域は「対象外」として白抜きにする */
  fillOf: (id: string) => string | null;
  selected?: string | null;
  onSelect?: (id: string) => void;
  /** 表示する範囲。省くと全体 */
  viewBox?: ViewBox;
  /** 補助の線（日本地図の南西諸島の枠など） */
  guide?: string;
};

const Shapes = memo(function Shapes({
  regions,
  fillOf,
  onSelect,
}: Pick<Props, 'regions' | 'fillOf' | 'onSelect'>) {
  return (
    <G>
      {regions.map((r) => {
        const fill = fillOf(r.id);
        return (
          <Path
            key={r.id}
            d={r.d}
            fill={fill ?? colors.white}
            stroke={fill === null ? '#DADAD6' : colors.white}
            strokeWidth={fill === null ? 0.6 : 0.8}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            onPress={onSelect ? () => onSelect(r.id) : undefined}
            accessibilityLabel={r.label}
          />
        );
      })}
    </G>
  );
});

export function RegionMap({ width, height, regions, fillOf, selected, onSelect, viewBox, guide }: Props) {
  const vb = viewBox ?? { x: 0, y: 0, w: width, h: height };
  const current = selected ? regions.find((r) => r.id === selected) : undefined;
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      preserveAspectRatio="xMidYMid meet">
      {guide && (
        <Path d={guide} fill="none" stroke={colors.control} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      )}
      <Shapes regions={regions} fillOf={fillOf} onSelect={onSelect} />
      {current && (
        <Path
          d={current.d}
          fill="none"
          stroke="#E5484D"
          strokeWidth={2.2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )}
    </Svg>
  );
}
