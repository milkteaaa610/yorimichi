/** 04 地図（都道府県・市区町村） */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { type PrefStat, getPrefStats } from '@/db/queries';
import { useLive, useSettings } from '@/db/provider';
import { Icon } from '@/ui/Icon';
import { TabScreen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { ProgressBar, Segmented } from '@/ui/controls';
import { Legend } from '@/ui/maps/Legend';
import { RegionMap } from '@/ui/maps/RegionMap';
import { getJapanMap } from '@/ui/maps/data';
import { PREF_LEVELS, colors, levelFor } from '@/ui/theme';

type ViewMode = 'pref' | 'muni';

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'pref', label: '都道府県' },
  { id: 'muni', label: '市区町村' },
];

export default function MapScreen() {
  const params = useLocalSearchParams<{ view?: string }>();
  const [settings] = useSettings();
  const stats = useLive((db) => getPrefStats(db, settings.countPass), [settings.countPass]);
  const [mode, setMode] = useState<ViewMode>('pref');
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (params.view === 'muni' || params.view === 'pref') setMode(params.view);
  }, [params.view]);

  const japan = getJapanMap();
  const byCode = useMemo(() => new Map(stats.map((s) => [String(s.code), s])), [stats]);
  const fillOf = useCallback(
    (id: string) => levelFor(PREF_LEVELS, byCode.get(id)?.visited ?? 0).bg,
    [byCode],
  );
  const prefVisited = stats.filter((s) => s.visited > 0).length;
  const muniVisited = stats.reduce((n, s) => n + s.muniVisited, 0);
  const current = selected ? byCode.get(selected) : undefined;

  const ranked = useMemo(() => [...stats].sort((a, b) => b.visited - a.visited || a.code - b.code), [stats]);
  const top = showAll ? ranked : ranked.filter((s) => s.visited > 0).slice(0, 5);
  const max = Math.max(1, ranked[0]?.visited ?? 1);

  const muniRanked = useMemo(
    () => [...stats].sort((a, b) => b.muniVisited - a.muniVisited || a.code - b.code),
    [stats],
  );
  const muniShown = showAll ? muniRanked : muniRanked.filter((s) => s.muniVisited > 0).slice(0, 8);
  const muniRest = muniRanked.filter((s) => s.muniVisited > 0).slice(8);
  const muniMax = Math.max(1, muniRanked[0]?.muniVisited ?? 1);

  return (
    <TabScreen testID="map-screen">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Text size={20} weight={700} accessibilityRole="header">
          地図
        </Text>
        <Segmented
          options={VIEWS}
          value={mode}
          onChange={(v) => {
            setMode(v);
            setShowAll(false);
          }}
          label="表示の単位"
          height={38}
          fontSize={13}
          pill
        />
      </View>

      {mode === 'pref' ? (
        <>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text testID="pref-visited" size={44} weight={600} tracking={-0.04} leading={1.1}>
                {prefVisited}
              </Text>
              <Text size={15} weight={600} color={colors.sub}>
                / 47 都道府県
              </Text>
            </View>
            <ProgressBar value={prefVisited / 47} label={`47都道府県のうち${prefVisited}を訪問`} />
          </View>

          <View style={{ gap: 12 }}>
            <View testID="japan-map" style={{ aspectRatio: japan.data.width / japan.data.height }}>
              <RegionMap
                width={japan.data.width}
                height={japan.data.height}
                regions={japan.regions}
                fillOf={fillOf}
                selected={selected}
                onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
                guide={japan.guide}
              />
              <Pressable
                testID="map-expand"
                accessibilityRole="button"
                accessibilityLabel="地図を大きく表示"
                onPress={() => router.push('/map-view')}
                style={{
                  position: 'absolute', right: 0, bottom: 0, height: 36, paddingHorizontal: 12, borderRadius: 999,
                  backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                }}>
                <Icon name="search" size={14} strokeWidth={2} />
                <Text size={12} weight={700}>
                  拡大
                </Text>
              </Pressable>
            </View>
            <Legend
              items={[...PREF_LEVELS].reverse().map((l) => ({ label: l.label, color: l.bg, outlined: l.min === 0 }))}
            />
            {current ? (
              <PrefCallout stat={current} />
            ) : (
              <Text size={12} color={colors.sub}>
                都道府県をタップすると、訪れた駅の数が出ます。
              </Text>
            )}
          </View>

          <View style={{ gap: 4 }}>
            <Text size={15} weight={700} style={{ marginBottom: 6 }} accessibilityRole="header">
              {showAll ? 'すべての都道府県' : 'よく訪れた都道府県'}
            </Text>
            {top.length === 0 && (
              <Text size={13} leading={1.6} color={colors.sub}>
                駅を記録すると、都道府県が塗られていきます。
              </Text>
            )}
            {top.map((p, i) => (
              <Pressable
                key={p.code}
                testID={`pref-row-${p.name}`}
                accessibilityRole="button"
                onPress={() => router.push(`/pref/${p.code}`)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48,
                  borderBottomWidth: 1, borderBottomColor: colors.hairline,
                }}>
                <Text size={12} weight={600} color={colors.sub} tabular style={{ width: 20 }}>
                  {i + 1}
                </Text>
                <Text size={14} weight={600} style={{ width: 64 }}>
                  {p.name}
                </Text>
                <View style={{ flex: 1 }}>
                  <ProgressBar value={p.visited > 0 ? Math.max(0.04, p.visited / max) : 0} height={4} />
                </View>
                <Text size={13} weight={600} tabular style={{ width: 48, textAlign: 'right' }}>
                  {p.visited}駅
                </Text>
                <Icon name="chevron-right" size={16} color={colors.mute} />
              </Pressable>
            ))}
            <ToggleAll showAll={showAll} onToggle={() => setShowAll((v) => !v)} label="すべての都道府県を見る" />
          </View>
        </>
      ) : (
        <>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text testID="muni-visited" size={44} weight={600} tracking={-0.04} leading={1.1}>
                {muniVisited}
              </Text>
              <Text size={15} weight={600} color={colors.sub}>
                市区町村
              </Text>
            </View>
            <Text size={12} leading={1.6} color={colors.sub}>
              駅を訪れたことのある市区町村の数です。都道府県をタップすると、市区町村ごとに見られます。
            </Text>
          </View>

          <View style={{ gap: 4 }}>
            <Text size={15} weight={700} style={{ marginBottom: 6 }} accessibilityRole="header">
              都道府県ごと
            </Text>
            {muniShown.length === 0 && (
              <Text size={13} leading={1.6} color={colors.sub}>
                駅を記録すると、訪れた市区町村がここに並びます。
              </Text>
            )}
            {muniShown.map((p) => (
              <Pressable
                key={p.code}
                testID={`muni-row-${p.name}`}
                accessibilityRole="button"
                onPress={() => router.push(`/pref/${p.code}`)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52,
                  borderBottomWidth: 1, borderBottomColor: colors.hairline,
                }}>
                <Text size={14} weight={600} style={{ width: 76 }}>
                  {p.name}
                </Text>
                <View style={{ flex: 1 }}>
                  <ProgressBar value={p.muniVisited > 0 ? Math.max(0.04, p.muniVisited / muniMax) : 0} height={4} />
                </View>
                <Text size={13} weight={600} tabular style={{ width: 84, textAlign: 'right' }}>
                  {p.muniVisited}
                  <Text size={12} weight={500} color={colors.sub}>
                    {' / '}
                    {p.muniCount}
                  </Text>
                </Text>
                <Icon name="chevron-right" size={16} color={colors.mute} />
              </Pressable>
            ))}
            {!showAll && muniRest.length > 0 && (
              <Text size={12} color={colors.sub} style={{ marginTop: 10 }}>
                ほか{muniRest.length}都道府県 · {muniRest.reduce((n, s) => n + s.muniVisited, 0)}市区町村
              </Text>
            )}
            <ToggleAll showAll={showAll} onToggle={() => setShowAll((v) => !v)} label="すべての都道府県を見る" />
          </View>
        </>
      )}
    </TabScreen>
  );
}

function PrefCallout({ stat }: { stat: PrefStat }) {
  return (
    <Pressable
      testID="pref-callout"
      accessibilityRole="button"
      onPress={() => router.push(`/pref/${stat.code}`)}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16,
        borderWidth: 1, borderColor: colors.border,
      }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text size={16} weight={700}>
          {stat.name}
        </Text>
        <Text size={12} color={colors.sub}>
          {stat.visited}駅を訪問 · 市区町村 {stat.muniVisited} / {stat.muniCount}
        </Text>
      </View>
      <Text size={13} weight={700}>
        市区町村を見る
      </Text>
      <Icon name="chevron-right" size={16} color={colors.mute} />
    </Pressable>
  );
}

function ToggleAll({ showAll, onToggle, label }: { showAll: boolean; onToggle: () => void; label: string }) {
  return (
    <Pressable
      testID="toggle-all"
      accessibilityRole="button"
      onPress={onToggle}
      style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text size={13} weight={600}>
        {showAll ? '訪れた順だけ表示' : label}
      </Text>
    </Pressable>
  );
}
