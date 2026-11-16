/** 全画面の地図。指で動かしたり拡大したりできる。都道府県を指定すると市区町村の地図になる。 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMuniStats, getPrefStats } from '@/db/queries';
import { useLive, useMaster, useSettings } from '@/db/provider';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { IconButton } from '@/ui/controls';
import { RegionMap } from '@/ui/maps/RegionMap';
import { Zoomable } from '@/ui/maps/Zoomable';
import { getJapanDetailMap, getMuniMap } from '@/ui/maps/data';
import { MUNI_LEVELS, PREF_LEVELS, colors, levelFor } from '@/ui/theme';

export default function MapViewScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ pref?: string }>();
  const prefCode = params.pref ? Number(params.pref) : null;
  const master = useMaster();
  const [settings] = useSettings();
  const [selected, setSelected] = useState<string | null>(null);

  const prefStats = useLive((db) => getPrefStats(db, settings.countPass), [settings.countPass]);
  const muniStats = useLive(
    (db) => (prefCode ? getMuniStats(db, prefCode, settings.countPass) : []),
    [prefCode, settings.countPass],
  );

  const view = useMemo(() => {
    if (prefCode) {
      const byCode = new Map(muniStats.map((m) => [m.code, m]));
      const map = getMuniMap(prefCode, (c) => {
        const m = byCode.get(c);
        return m ? (m.city ?? '') + m.name : c;
      });
      if (!map) return null;
      return {
        title: master.prefName(prefCode),
        width: map.data.width,
        height: map.data.height,
        regions: map.regions,
        guide: undefined,
        fill: (id: string) => {
          const m = byCode.get(id);
          return !m || !m.hasStation ? null : levelFor(MUNI_LEVELS, m.visited).bg;
        },
        describe: (id: string) => {
          const m = byCode.get(id);
          if (!m) return null;
          return {
            name: (m.city ?? '') + m.name,
            sub: m.hasStation ? `${m.visited} / ${m.stationCount}駅を訪問` : '駅なし（達成率には数えません）',
            href: null as string | null,
          };
        },
      };
    }
    const japan = getJapanDetailMap();
    const byCode = new Map(prefStats.map((s) => [String(s.code), s]));
    return {
      title: '日本',
      width: japan.data.width,
      height: japan.data.height,
      regions: japan.regions,
      guide: japan.guide,
      fill: (id: string) => levelFor(PREF_LEVELS, byCode.get(id)?.visited ?? 0).bg,
      describe: (id: string) => {
        const s = byCode.get(id);
        if (!s) return null;
        return {
          name: s.name,
          sub: `${s.visited}駅を訪問 · 市区町村 ${s.muniVisited} / ${s.muniCount}`,
          href: `/pref/${s.code}`,
        };
      },
    };
  }, [prefCode, muniStats, prefStats, master]);

  const fillOf = useCallback((id: string) => view?.fill(id) ?? null, [view]);
  const info = selected && view ? view.describe(selected) : null;

  return (
    <View testID="map-view-screen" style={{ flex: 1, backgroundColor: colors.white }}>
      <View
        style={{
          paddingTop: insets.top + 4,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
          paddingBottom: 4,
        }}>
        <IconButton icon="close" label="閉じる" onPress={() => router.back()} />
        <Text size={16} weight={700} accessibilityRole="header">
          {view?.title ?? ''}
        </Text>
      </View>
      {view && (
        <View style={{ flex: 1, overflow: 'hidden', backgroundColor: '#FBFBFA' }}>
          <Zoomable width={view.width} height={view.height} maxScale={prefCode ? 10 : 14}>
            {(vb) => (
              <RegionMap
                width={view.width}
                height={view.height}
                regions={view.regions}
                fillOf={fillOf}
                selected={selected}
                onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
                viewBox={vb}
                guide={view.guide}
              />
            )}
          </Zoomable>
        </View>
      )}
      {info && (
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16) }}>
          <Pressable
            accessibilityRole={info.href ? 'button' : undefined}
            disabled={!info.href}
            onPress={() => info.href && router.push(info.href as never)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16,
              borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
            }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text size={16} weight={700}>
                {info.name}
              </Text>
              <Text size={12} color={colors.sub}>
                {info.sub}
              </Text>
            </View>
            {info.href && <Icon name="chevron-right" size={18} color={colors.mute} />}
          </Pressable>
        </View>
      )}
    </View>
  );
}
