/**
 * 地図を指で動かす・拡大するための枠。全画面の地図で使う。
 *
 * 画像を引き伸ばすのではなく、表示する範囲（viewBox）を変えて描き直すので、拡大しても線がぼやけない。
 * 1本指のドラッグで移動、2本指でピンチ、右下のボタンでも拡大・縮小できる。
 * ジェスチャーは react-native-gesture-handler（v3 のフック）で受ける。
 */
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, View } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';

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

/** ジェスチャーの始まりの状態と、いまの動き。表示範囲はここから計算する。 */
type Gesture2D = {
  base: View2D;
  /** ピンチを始めた点（枠の中の位置） */
  focal: { x: number; y: number };
  tx: number;
  ty: number;
  scale: number;
};

/** ジェスチャーの動きを、表示する範囲に直す（指の下の地図の点が、指についてくるように）。 */
export function applyGesture(
  content: { width: number; height: number },
  container: { width: number; height: number },
  g: Gesture2D,
): View2D {
  const unit = Math.max(content.width / container.width, content.height / container.height);
  const k0 = unit / g.base.scale;
  const scale = g.base.scale * g.scale;
  const k1 = unit / scale;
  const mapX = g.base.cx + (g.focal.x - container.width / 2) * k0;
  const mapY = g.base.cy + (g.focal.y - container.height / 2) * k0;
  return {
    scale,
    cx: mapX - (g.focal.x + g.tx - container.width / 2) * k1,
    cy: mapY - (g.focal.y + g.ty - container.height / 2) * k1,
  };
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
  // 指を置いている間の状態。描画には使わず、ジェスチャーの中だけで読み書きする
  const gesture = useRef<(Gesture2D & { panOrigin: { x: number; y: number } }) | null>(null);

  const apply = (next: View2D) => {
    if (box) setView(clampView(content, box, next, maxScale));
  };
  /** いまの表示を起点にして、ジェスチャーを測り始める。pan は、その時点までのパンの移動量 */
  const begin = (focal: { x: number; y: number } | null, pan: { x: number; y: number }) => {
    if (!box) return;
    const g = gesture.current;
    const base = g ? applyGesture(content, box, g) : view;
    gesture.current = {
      base,
      focal: focal ?? g?.focal ?? { x: box.width / 2, y: box.height / 2 },
      tx: 0,
      ty: 0,
      scale: 1,
      panOrigin: pan,
    };
  };
  const onPan = (x: number, y: number) => {
    if (!gesture.current) begin(null, { x, y });
    const g = gesture.current;
    if (!g || !box) return;
    g.tx = x - g.panOrigin.x;
    g.ty = y - g.panOrigin.y;
    apply(applyGesture(content, box, g));
  };
  const onPinch = (scale: number) => {
    const g = gesture.current;
    if (!g || !box) return;
    g.scale = scale;
    apply(applyGesture(content, box, g));
  };

  // パンの移動量は、パンを始めてからの合計で届く。ピンチの前後で起点を取り直すために覚えておく
  const lastPan = useRef({ x: 0, y: 0 });
  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 6,
    onActivate: (e) => {
      lastPan.current = { x: e.translationX, y: e.translationY };
      onPan(e.translationX, e.translationY);
    },
    onUpdate: (e) => {
      lastPan.current = { x: e.translationX, y: e.translationY };
      onPan(e.translationX, e.translationY);
    },
    onFinalize: () => {
      lastPan.current = { x: 0, y: 0 };
      gesture.current = null;
    },
  });
  const pinch = usePinchGesture({
    runOnJS: true,
    onActivate: (e) => begin({ x: e.focalX, y: e.focalY }, lastPan.current),
    onUpdate: (e) => onPinch(e.scale),
    // ピンチだけ終わってパンが続くときは、次のパンの動きで起点を取り直す
    onFinalize: () => {
      gesture.current = null;
    },
  });
  const both = useSimultaneousGestures(pan, pinch);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 0 && h > 0) setBox({ width: w, height: h });
  };

  const zoomBy = (factor: number) => apply({ ...view, scale: view.scale * factor });

  return (
    <View style={{ flex: 1 }}>
      <GestureDetector gesture={both}>
        <View style={{ flex: 1 }} onLayout={onLayout}>
          {box && children(computeViewBox(content, box, view))}
        </View>
      </GestureDetector>
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
