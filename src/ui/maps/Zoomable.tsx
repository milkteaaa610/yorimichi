/**
 * 地図を指で動かす・拡大するための枠。全画面の地図で使う。
 *
 * 画像を引き伸ばすのではなく、表示する範囲（viewBox）を変えて描き直すので、拡大しても線がぼやけない。
 * 1本指のドラッグで移動、2本指でピンチ、右下のボタンでも拡大・縮小できる。
 */
import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, PanResponder, Pressable, View } from 'react-native';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { colors } from '../theme';
import type { ViewBox } from './RegionMap';

type View2D = { scale: number; cx: number; cy: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 表示範囲を計算する（テストしやすいよう、部品の外に出してある）。 */
export function computeViewBox(
  content: { width: number; height: number },
  container: { width: number; height: number },
  view: View2D,
): ViewBox {
  // 等倍で全体が収まる「1ピクセルあたりの地図の長さ」
  const unit = Math.max(content.width / container.width, content.height / container.height);
  const w = (container.width * unit) / view.scale;
  const h = (container.height * unit) / view.scale;
  return { x: view.cx - w / 2, y: view.cy - h / 2, w, h };
}

/** 地図の外へ行きすぎないように中心を直す。 */
export function clampView(
  content: { width: number; height: number },
  container: { width: number; height: number },
  view: View2D,
  maxScale: number,
): View2D {
  const scale = clamp(view.scale, 1, maxScale);
  const unit = Math.max(content.width / container.width, content.height / container.height);
  const w = (container.width * unit) / scale;
  const h = (container.height * unit) / scale;
  const fit = (c: number, size: number, visible: number) =>
    visible >= size ? size / 2 : clamp(c, visible / 2, size - visible / 2);
  return { scale, cx: fit(view.cx, content.width, w), cy: fit(view.cy, content.height, h) };
}

export function Zoomable({
  width,
  height,
  maxScale = 8,
  children,
}: {
  /** 地図の大きさ（viewBox の単位） */
  width: number;
  height: number;
  maxScale?: number;
  children: (viewBox: ViewBox) => ReactNode;
}) {
  const content = useMemo(() => ({ width, height }), [width, height]);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const [view, setView] = useState<View2D>({ scale: 1, cx: width / 2, cy: height / 2 });
  const live = useRef({ view, box, content, maxScale });
  live.current = { view, box, content, maxScale };

  const start = useRef<{
    view: View2D;
    touches: number;
    x: number;
    y: number;
    dist: number;
    focal: { x: number; y: number };
  } | null>(null);

  const apply = useCallback((next: View2D) => {
    const { box: b, content: c, maxScale: m } = live.current;
    if (!b) return;
    setView(clampView(c, b, next, m));
  }, []);

  const responder = useMemo(() => {
    const read = (e: GestureResponderEvent) => {
      const t = e.nativeEvent.touches;
      if (t.length >= 2) {
        const dx = t[0].pageX - t[1].pageX;
        const dy = t[0].pageY - t[1].pageY;
        return {
          touches: 2,
          x: (t[0].locationX + t[1].locationX) / 2,
          y: (t[0].locationY + t[1].locationY) / 2,
          px: (t[0].pageX + t[1].pageX) / 2,
          py: (t[0].pageY + t[1].pageY) / 2,
          dist: Math.hypot(dx, dy),
        };
      }
      const one = t[0] ?? e.nativeEvent;
      return { touches: 1, x: one.locationX, y: one.locationY, px: one.pageX, py: one.pageY, dist: 0 };
    };
    const begin = (e: GestureResponderEvent) => {
      const { view: v, box: b, content: c } = live.current;
      if (!b) return;
      const p = read(e);
      const vb = computeViewBox(c, b, v);
      start.current = {
        view: v,
        touches: p.touches,
        x: p.px,
        y: p.py,
        dist: p.dist,
        // 指の下にある地図上の点。拡大してもこの点が指の下に残るようにする
        focal: { x: vb.x + (p.x / b.width) * vb.w, y: vb.y + (p.y / b.height) * vb.h },
      };
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (e, g) =>
        e.nativeEvent.touches.length >= 2 || Math.abs(g.dx) + Math.abs(g.dy) > 6,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: begin,
      onPanResponderMove: (e) => {
        const { box: b, content: c } = live.current;
        if (!b) return;
        const p = read(e);
        // 指の本数が変わったら、そこから測り直す
        if (!start.current || start.current.touches !== p.touches) {
          begin(e);
          return;
        }
        const s = start.current;
        const unit = Math.max(c.width / b.width, c.height / b.height);
        const scale =
          p.touches === 2 && s.dist > 0 ? s.view.scale * (p.dist / s.dist) : s.view.scale;
        const k = unit / scale;
        if (p.touches === 2) {
          const { width: bw, height: bh } = b;
          // ピンチの中心に、始めた時と同じ地図上の点が来るように
          const cxNow = s.focal.x - (p.x - bw / 2) * k;
          const cyNow = s.focal.y - (p.y - bh / 2) * k;
          apply({ scale, cx: cxNow, cy: cyNow });
        } else {
          apply({ scale, cx: s.view.cx - (p.px - s.x) * k, cy: s.view.cy - (p.py - s.y) * k });
        }
      },
      onPanResponderRelease: () => {
        start.current = null;
      },
      onPanResponderTerminate: () => {
        start.current = null;
      },
    });
  }, [apply]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 0 && h > 0) setBox({ width: w, height: h });
  };

  const zoomBy = (factor: number) => apply({ ...view, scale: view.scale * factor });

  return (
    <View style={{ flex: 1 }} onLayout={onLayout} {...responder.panHandlers}>
      {box && children(computeViewBox(content, box, view))}
      <View style={{ position: 'absolute', right: 16, bottom: 16, gap: 8 }}>
        <ZoomButton label="拡大" onPress={() => zoomBy(1.6)} disabled={view.scale >= maxScale}>
          <Icon name="plus" size={20} />
        </ZoomButton>
        <ZoomButton label="縮小" onPress={() => zoomBy(1 / 1.6)} disabled={view.scale <= 1}>
          <View style={{ width: 14, height: 2, borderRadius: 1, backgroundColor: colors.ink }} />
        </ZoomButton>
        {view.scale > 1 && (
          <ZoomButton label="全体を表示" onPress={() => apply({ scale: 1, cx: width / 2, cy: height / 2 })}>
            <Text size={11} weight={700}>
              全体
            </Text>
          </ZoomButton>
        )}
      </View>
    </View>
  );
}

function ZoomButton({
  label,
  onPress,
  disabled,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        borderRadius: 999,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
      }}>
      {children}
    </Pressable>
  );
}
