/** 01 ホーム */
import { Link, router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { getPendingCandidates, getRecentVisits, getTotals, getVisitCount } from '@/db/queries';
import { useLive, useMaster, useSettings } from '@/db/provider';
import { KIND_LABEL, formatShort, isToday, toDateKey } from '@/lib/date';
import { Icon } from '@/ui/Icon';
import { TabScreen } from '@/ui/Screen';
import { RowMeta, StationRow } from '@/ui/StationRow';
import { Text } from '@/ui/Text';
import { IconButton, PrimaryButton } from '@/ui/controls';
import { colors } from '@/ui/theme';

export default function HomeScreen() {
  const master = useMaster();
  const [settings] = useSettings();
  const totals = useLive((db) => getTotals(db, settings.countPass), [settings.countPass]);
  const recent = useLive((db) => getRecentVisits(db, 5));
  const visitCount = useLive((db) => getVisitCount(db));
  const pending = useLive((db) => getPendingCandidates(db));
  const year = new Date().getFullYear();

  return (
    <TabScreen gap={32} testID="home-screen">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text size={20} weight={700} tracking={0.04} accessibilityRole="header">
          エキログ
        </Text>
        <IconButton icon="search" label="駅を検索" filled size={20} onPress={() => router.push('/search')} testID="home-search" />
      </View>

      {pending.length > 0 && (
        <Pressable
          testID="auto-banner"
          accessibilityRole="button"
          onPress={() => router.push('/auto-review')}
          style={{
            marginTop: -12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
          }}>
          <View
            style={{
              width: 40, height: 40, borderRadius: 999, backgroundColor: colors.ink,
              alignItems: 'center', justifyContent: 'center',
            }}>
            <Icon name="signal" size={20} color={colors.white} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text size={14} weight={700}>
              自動で{pending.length}駅を見つけました
            </Text>
            <Text size={12} color={colors.sub} numberOfLines={1}>
              {candidateSummary(pending.map((p) => ({ name: master.station(p.stationId)?.name ?? '', at: p.detectedAt })))}
            </Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.mute} />
        </Pressable>
      )}

      <View style={{ gap: 20 }}>
        <View style={{ gap: 6 }}>
          <Text size={13} weight={500} color={colors.sub}>
            これまでに訪れた駅
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text testID="total-stations" size={68} weight={600} tracking={-0.045} leading={1} tabular>
              {totals.stations}
            </Text>
            <Text size={18} weight={700}>
              駅
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <StatTile label="都道府県" href="/map">
            {totals.prefectures}
            <Text size={12} weight={500} color={colors.sub}>
              {' / 47'}
            </Text>
          </StatTile>
          <StatTile label="市区町村" href="/map?view=muni">
            {totals.municipalities}
          </StatTile>
          <StatTile label="制覇した路線" href="/lines?filter=done">
            {totals.linesCompleted}
          </StatTile>
          <StatTile label={`${year}年の新駅`}>{totals.newThisYear}</StatTile>
        </View>
      </View>

      {visitCount === 0 ? (
        <View style={{ gap: 12, padding: 20, borderRadius: 16, backgroundColor: colors.surface }}>
          <Text size={15} weight={700}>
            最初の駅を記録しましょう
          </Text>
          <Text size={13} leading={1.6} color={colors.body}>
            いまいる駅を記録するか、これまでに行った駅を路線からまとめて登録できます。
          </Text>
          <View style={{ gap: 8, marginTop: 4 }}>
            <PrimaryButton label="駅を記録する" height={48} onPress={() => router.push('/checkin')} testID="empty-checkin" />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/lines')}
              style={{
                height: 48, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1,
                borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center',
              }}>
              <Text size={15} weight={700}>
                路線からまとめて登録
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text size={15} weight={700} accessibilityRole="header">
              最近の記録
            </Text>
            <Link href="/visits" asChild>
              <Pressable accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text size={13} weight={500} color={colors.sub}>
                  すべて見る
                </Text>
              </Pressable>
            </Link>
          </View>
          <View testID="recent-list">
            {recent.map((v) => {
              const station = master.station(v.stationId);
              if (!station) return null;
              return (
                <StationRow
                  key={v.id}
                  testID={`recent-${station.name}`}
                  name={station.name}
                  badges={master.badges(station.id)}
                  sub={master.describe(station.id)}
                  first={v.isFirst}
                  right={<RowMeta top={v.visitedOn ? formatShort(v.visitedOn) : '日付なし'} bottom={KIND_LABEL[v.kind]} />}
                  onPress={() => router.push(`/station/${station.id}`)}
                />
              );
            })}
          </View>
        </View>
      )}
    </TabScreen>
  );
}

function StatTile({ label, href, children }: { label: string; href?: string; children: ReactNode }) {
  const body = (
    <>
      <Text size={11} weight={500} color={colors.sub}>
        {label}
      </Text>
      <Text size={22} weight={600} tracking={-0.02} leading={1.1} tabular>
        {children}
      </Text>
    </>
  );
  const style = {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 8,
  } as const;
  if (!href) return <View style={style}>{body}</View>;
  return (
    <Pressable accessibilityRole="link" onPress={() => router.push(href as never)} style={style}>
      {body}
    </Pressable>
  );
}

/** 「今日 · 鎌倉 → 長谷 · タップして確認」 */
function candidateSummary(list: { name: string; at: number }[]): string {
  const first = list[0];
  const last = list[list.length - 1];
  const day = toDateKey(new Date(last.at));
  const when = isToday(day) ? '今日' : formatShort(day);
  const route = first.name === last.name ? first.name : `${first.name} → ${last.name}`;
  return `${when} · ${route} · タップして確認`;
}
