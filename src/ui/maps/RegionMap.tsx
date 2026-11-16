/**
 * 地図を描く部品。都道府県の日本地図にも、市区町村の地図にも使う。
 *
 * 形は scripts/build-master が作った SVG のパス（assets/map）で、ここでは色を塗って並べるだけ。
 * 境界線の太さは拡大しても変わらない（non-scaling-stroke）。
 * タップは地図全体で受けて、どの地域かを hitTest.ts で計算する。
 */
import { type ComponentRef, memo, useMemo, useRef } from 'react';
import { type GestureResponderEvent, Pressable, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { colors } from '../theme';
import { RegionIndex } from './hitTest';

export type Region = { id: string; d: string; label: string };

const COAST = '#CFCFCB';

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
  /** 読み上げ用の説明 */
  label?: string;
};

const Shapes = memo(function Shapes({ regions, fillOf }: Pick<Props, 'regions' | 'fillOf'>) {
  return (
    <G>
      {/* 海岸線。塗りの下に太めの線を引き、内側の境界は上の塗りで隠れて、外側（海岸）だけが残る */}
      {regions.map((r) => (
        <Path
          key={`coast-${r.id}`}
          d={r.d}
          fill="none"
          stroke={COAST}
          strokeWidth={1.6}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
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
          />
        );
      })}
    </G>
  );
});

export function RegionMap({ width, height, regions, fillOf, selected, onSelect, viewBox, guide, label }: Props) {
  const vb = viewBox ?? { x: 0, y: 0, w: width, h: height };
  const current = selected ? regions.find((r) => r.id === selected) : undefined;
  const index = useMemo(() => new RegionIndex(regions), [regions]);
  const box = useRef<ComponentRef<typeof View>>(null);

  const onPress = (e: GestureResponderEvent) => {
    if (!onSelect || !box.current) return;
    const { pageX, pageY } = e.nativeEvent;
    box.current.measureInWindow((left, top, w, h) => {
      if (w === 0 || h === 0) return;
      const v = vb;
      // preserveAspectRatio="xMidYMid meet" と同じ計算で、画面の位置を地図の座標に直す
      const scale = Math.min(w / v.w, h / v.h);
      const ox = (w - v.w * scale) / 2;
      const oy = (h - v.h * scale) / 2;
      const x = v.x + (pageX - left - ox) / scale;
      const y = v.y + (pageY - top - oy) / scale;
      // 指の太さぶん（画面上で約10pt）は外れていても拾う
      const id = index.hit(x, y, 10 / scale);
      if (id) onSelect(id);
    });
  };

  return (
    <Pressable
      ref={box}
      onPress={onSelect ? onPress : undefined}
      accessibilityLabel={label}
      accessibilityRole={label ? 'image' : undefined}
      style={{ width: '100%', height: '100%' }}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        pointerEvents="none">
        {guide && (
          <Path d={guide} fill="none" stroke={colors.control} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        )}
        <Shapes regions={regions} fillOf={fillOf} />
        {current && (
          <Path
            d={current.d}
            fill="none"
            stroke="#E5484D"
            strokeWidth={2.2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </Svg>
    </Pressable>
  );
}
