/** 11 市区町村（都道府県ごと） */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { type MuniStat, getMuniStats } from '@/db/queries';
import { useLive, useMaster, useSettings } from '@/db/provider';
import { Icon } from '@/ui/Icon';
import { HeaderBar, StackScreen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { IconButton, ProgressBar } from '@/ui/controls';
import { Legend } from '@/ui/maps/Legend';
import { RegionMap } from '@/ui/maps/RegionMap';
import { getMuniMap } from '@/ui/maps/data';
import { MUNI_LEVELS, colors, levelFor } from '@/ui/theme';

/** 区部・市部・郡ごと（町村部）に分ける。北海道は振興局がないので、郡でまとめる。 */
function groupMunis(list: MuniStat[], prefCode: number): { name: string; items: MuniStat[] }[] {
  const groups: { name: string; items: MuniStat[] }[] = [];
  const push = (name: string, m: MuniStat) => {
    const g = groups.find((x) => x.name === name);
    if (g) g.items.push(m);
    else groups.push({ name, items: [m] });
  };
  for (const m of list) {
    if (m.kind === 'special-ward') push('区部', m);
    else if (m.kind === 'ward') push(m.city ?? '区', m);
    else if (m.kind === 'city') push('市部', m);
    else push(prefCode === 13 ? '町村部' : '町村部', m);
  }
  return groups;
}

export default function PrefScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const prefCode = Number(code);
  const master = useMaster();
  const [settings] = useSettings();
  const all = useLive((db) => getMuniStats(db, prefCode, settings.countPass), [prefCode, settings.countPass]);
  const [selected, setSelected] = useState<string | null>(null);
  const [showNoStation, setShowNoStation] = useState(false);

  const withStation = useMemo(() => all.filter((m) => m.hasStation), [all]);
  const noStation = useMemo(() => all.filter((m) => !m.hasStation), [all]);
  const visitedMunis = withStation.filter((m) => m.visited > 0).length;
  const visitedStations = withStation.reduce((n, m) => n + m.visited, 0);
  const groups = useMemo(() => groupMunis(withStation, prefCode), [withStation, prefCode]);
  const byCode = useMemo(() => new Map(all.map((m) => [m.code, m])), [all]);
  const map = getMuniMap(prefCode, (c) => {
    const m = byCode.get(c);
    return m ? (m.city ?? '') + m.name : c;
  });
  const fillOf = useCallback(
    (id: string) => {
      const m = byCode.get(id);
      if (!m || !m.hasStation) return null;
      return levelFor(MUNI_LEVELS, m.visited).bg;
    },
    [byCode],
  );
  const current = selected ? byCode.get(selected) : undefined;
  const prefName = master.prefName(prefCode);
  const excludedNote = noStation.length > 0 ? noStationNote(noStation) : '';

  return (
    <StackScreen
      testID="pref-screen"
      gap={26}
      contentStyle={{ paddingBottom: 32 }}
      header={
        <HeaderBar
          left={<IconButton icon="chevron-left" label="地図に戻る" onPress={() => router.back()} testID="pref-back" />}
          right={
            map ? (
              <IconButton
                icon="map"
                label="地図を大きく表示"
                onPress={() => router.push(`/map-view?pref=${prefCode}`)}
              />
            ) : undefined
          }
        />
      }>
      <View style={{ gap: 6 }}>
        <Text size={12} weight={500} color={colors.sub}>
          都道府県
        </Text>
        <Text testID="pref-name" size={34} weight={700} leading={1.2} accessibilityRole="header">
          {prefName}
        </Text>
        <Text size={13} color={colors.sub}>
          {visitedStations}駅を訪問
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text testID="muni-progress" size={40} weight={600} tracking={-0.04} leading={1.1}>
            {visitedMunis}
          </Text>
          <Text size={14} weight={600} color={colors.sub}>
            / {withStation.length} 区市町村
          </Text>
        </View>
        <ProgressBar
          value={withStation.length > 0 ? visitedMunis / withStation.length : 0}
          label={`駅のある${withStation.length}区市町村のうち${visitedMunis}を訪問`}
        />
        <Text size={12} leading={1.6} color={colors.sub}>
          駅のある区市町村だけを数えています{excludedNote}。
        </Text>
      </View>

      {map && (
        <View style={{ gap: 12 }}>
          <View
            testID="muni-map"
            style={{ aspectRatio: map.data.width / map.data.height, maxHeight: 420, alignSelf: 'center', width: '100%' }}>
            <RegionMap
              width={map.data.width}
              height={map.data.height}
              regions={map.regions}
              fillOf={fillOf}
              selected={selected}
              onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
            />
          </View>
          <Legend
            align="flex-start"
            items={[
              ...[...MUNI_LEVELS].reverse().map((l) => ({ label: l.label, color: l.bg, outlined: l.min === 0 })),
              { label: '駅なし', color: colors.white, outlined: true },
            ]}
          />
          {current && (
            <View
              testID="muni-callout"
              style={{ padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
              <Text size={16} weight={700}>
                {(current.city ?? '') + current.name}
              </Text>
              <Text size={12} color={colors.sub}>
                {current.hasStation
                  ? `${current.visited} / ${current.stationCount}駅を訪問`
                  : '駅がないため、達成率には数えません'}
              </Text>
            </View>
          )}
        </View>
      )}

      {groups.map((g) => {
        const visited = g.items.filter((m) => m.visited > 0).length;
        return (
          <View key={g.name} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Text size={15} weight={700} accessibilityRole="header">
                {g.name}
              </Text>
              <Text size={12} weight={600} tabular>
                {visited}
                <Text size={12} weight={500} color={colors.sub}>
                  {' / '}
                  {g.items.length}
                </Text>
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {g.items.map((m) => {
                const lv = levelFor(MUNI_LEVELS, m.visited);
                const on = selected === m.code;
                return (
                  <Pressable
                    key={m.code}
                    testID={`muni-${m.name}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${m.name} ${m.visited > 0 ? `${m.visited}駅` : '未訪問'}`}
                    onPress={() => setSelected((cur) => (cur === m.code ? null : m.code))}
                    style={{
                      width: '32%',
                      flexGrow: 0,
                      minHeight: 56,
                      paddingVertical: 9,
                      paddingHorizontal: 10,
                      borderRadius: 12,
                      backgroundColor: lv.bg,
                      justifyContent: 'space-between',
                      gap: 6,
                      borderWidth: on ? 2 : 0,
                      borderColor: '#E5484D',
                    }}>
                    <Text size={13} weight={600} color={lv.fg} numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Text size={11} color={lv.sub} tabular>
                      {m.visited > 0 ? `${m.visited}駅` : '未訪問'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}

      {noStation.length > 0 && (
        <View style={{ gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowNoStation((v) => !v)}
            style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text size={13} weight={600}>
              駅のない市区町村（{noStation.length}）
            </Text>
            <Icon name={showNoStation ? 'chevron-down' : 'chevron-right'} size={16} color={colors.mute} />
          </Pressable>
          {showNoStation && (
            <Text size={12} leading={1.7} color={colors.sub}>
              {noStation.map((m) => (m.city ?? '') + m.name).join('、')}
            </Text>
          )}
        </View>
      )}
    </StackScreen>
  );
}

/** 「（武蔵村山市・日の出町・檜原村・島しょ部の9町村は除外）」のような注記。 */
function noStationNote(list: MuniStat[]): string {
  const names = list.map((m) => (m.city ?? '') + m.name);
  if (names.length <= 4) return `（${names.join('・')}は除外）`;
  return `（${names.slice(0, 3).join('・')}ほか${names.length - 3}市区町村は除外）`;
}
