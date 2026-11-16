/** 03 駅の詳細 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { StationLine } from '@/data/master';
import {
  type VisitRow,
  deleteVisit,
  getExcludedStations,
  getStationPhotos,
  getStationSummary,
  getStationVisits,
  setExcluded,
  updateVisit,
} from '@/db/queries';
import { useLive, useMaster, useMutate } from '@/db/provider';
import { KIND_LABEL, formatDotted, formatLong } from '@/lib/date';
import { ActionSheet, type SheetAction } from '@/ui/ActionSheet';
import { Icon } from '@/ui/Icon';
import { LineMark } from '@/ui/LineMark';
import { PhotoThumb } from '@/ui/PhotoThumb';
import { HeaderBar, StackScreen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { IconButton, PrimaryButton } from '@/ui/controls';
import { colors } from '@/ui/theme';

export default function StationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stationId = Number(id);
  const master = useMaster();
  const mutate = useMutate();
  const station = master.station(stationId);
  const summary = useLive((db) => getStationSummary(db, stationId), [stationId]);
  const visits = useLive((db) => getStationVisits(db, stationId), [stationId]);
  const photos = useLive((db) => getStationPhotos(db, stationId), [stationId]);
  const excluded = useLive((db) => getExcludedStations(db).includes(stationId), [stationId]);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState<VisitRow | null>(null);
  const [allVisits, setAllVisits] = useState(false);
  const [allPhotos, setAllPhotos] = useState(false);

  if (!station) {
    return (
      <StackScreen
        header={<HeaderBar left={<IconButton icon="chevron-left" label="戻る" onPress={() => router.back()} />} />}>
        <Text size={15}>この駅は見つかりませんでした。</Text>
      </StackScreen>
    );
  }

  const lines = master.stationLines(stationId);
  const groups = groupByOperator(lines);
  const numbered = lines.filter((l) => l.line.code && l.number).length;
  const shownVisits = allVisits ? visits : visits.slice(0, 3);
  const shownPhotos = allPhotos ? photos : photos.slice(0, 6);
  const reading = [station.kana, station.romaji].filter(Boolean).join(' · ');

  const visitActions: SheetAction[] = editing
    ? [
        ...(['got_off', 'transfer', 'pass'] as const).map((k) => ({
          label: `「${KIND_LABEL[k]}」にする`,
          selected: editing.kind === k,
          onPress: () => mutate((db) => updateVisit(db, editing.id, { kind: k })),
        })),
        { label: 'この記録を削除', destructive: true, onPress: () => mutate((db) => deleteVisit(db, editing.id)) },
      ]
    : [];

  return (
    <StackScreen
      testID="station-screen"
      gap={30}
      header={
        <HeaderBar
          left={<IconButton icon="chevron-left" label="戻る" onPress={() => router.back()} testID="station-back" />}
          right={<IconButton icon="more" label="その他の操作" onPress={() => setMenu(true)} />}
        />
      }
      footer={
        <PrimaryButton
          testID="station-checkin"
          label="この駅を記録する"
          onPress={() => router.push(`/checkin?stationId=${stationId}`)}
        />
      }>
      <View style={{ gap: 6 }}>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push(`/pref/${station.prefCode}`)}
          style={{ alignSelf: 'flex-start', minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text size={12} weight={500} color={colors.sub}>
            {master.prefName(station.prefCode)} {master.muniName(station.muniCode)}
          </Text>
          <Icon name="chevron-right" size={14} color={colors.sub} strokeWidth={2} />
        </Pressable>
        <Text testID="station-name" size={44} weight={700} tracking={0.02} leading={1.2} accessibilityRole="header">
          {station.name}
        </Text>
        {reading !== '' && (
          <Text size={13} color={colors.sub}>
            {reading}
          </Text>
        )}
      </View>

      <View
        style={{
          flexDirection: 'row',
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.hairline,
        }}>
        <SummaryCell label="訪問回数" first>
          <Text testID="visit-count" size={22} weight={600} tracking={-0.02} leading={1.1}>
            {summary.count}
            <Text size={12} weight={500} color={colors.sub}>
              {' 回'}
            </Text>
          </Text>
        </SummaryCell>
        <SummaryCell label="はじめて">
          <Text size={14} weight={600}>
            {summary.first ? formatDotted(summary.first) : summary.hasUndated ? '日付なし' : '—'}
          </Text>
        </SummaryCell>
        <SummaryCell label="最後">
          <Text size={14} weight={600}>
            {summary.last ? formatDotted(summary.last) : summary.hasUndated ? '日付なし' : '—'}
          </Text>
        </SummaryCell>
      </View>

      <View style={{ gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text size={15} weight={700} accessibilityRole="header">
            {numbered > 0 ? '駅ナンバリング' : '路線'}
          </Text>
          <Text size={12} color={colors.sub}>
            {lines.length}路線
          </Text>
        </View>
        {groups.map((g) => (
          <View key={g.operator} style={{ gap: 10 }}>
            <Text size={11} weight={600} color={colors.sub} tracking={0.04}>
              {g.operator}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, columnGap: 12 }}>
              {g.lines.map((sl) => (
                <Pressable
                  key={sl.line.id}
                  accessibilityRole="link"
                  accessibilityLabel={`${sl.line.name}を開く`}
                  onPress={() => router.push(`/line/${sl.line.id}`)}
                  style={{ width: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <LineMark line={sl.line} number={sl.number} size={40} />
                  <Text size={12} weight={500} leading={1.35} style={{ flex: 1 }}>
                    {sl.line.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </View>

      {photos.length > 0 && (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text size={15} weight={700} accessibilityRole="header">
              写真
            </Text>
            {photos.length > 6 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setAllPhotos((v) => !v)}
                style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text size={13} weight={500} color={colors.sub}>
                  {allPhotos ? '少なく表示' : `すべて見る（${photos.length}枚）`}
                </Text>
              </Pressable>
            )}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, borderRadius: 14, overflow: 'hidden' }}>
            {shownPhotos.map((p) => (
              <View key={p.id} style={{ width: '32.4%', flexGrow: 1, maxWidth: '33.4%' }}>
                <PhotoThumb uri={p.assetId ?? p.uri} fill radius={0} />
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={{ gap: 4 }}>
        <Text size={15} weight={700} style={{ marginBottom: 8 }} accessibilityRole="header">
          訪問の記録
        </Text>
        {visits.length === 0 && (
          <Text size={13} color={colors.sub} style={{ paddingBottom: 8 }}>
            まだ記録がありません。
          </Text>
        )}
        {shownVisits.map((v) => (
          <Pressable
            key={v.id}
            testID={`visit-${v.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${v.visitedOn ? formatLong(v.visitedOn) : '日付なし'} ${KIND_LABEL[v.kind]}。タップで編集`}
            onPress={() => setEditing(v)}
            style={{ flexDirection: 'row', gap: 14 }}>
            <View style={{ width: 10, alignItems: 'center' }}>
              <View style={{ marginTop: 6, width: 9, height: 9, borderRadius: 999, backgroundColor: colors.ink }} />
              <View style={{ flex: 1, width: 1.5, backgroundColor: colors.border, marginTop: 4 }} />
            </View>
            <View style={{ flex: 1, paddingBottom: 20, gap: 5 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Text size={14} weight={600}>
                  {v.visitedOn ? formatLong(v.visitedOn) : '日付なし'}
                </Text>
                <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.surface }}>
                  <Text size={11} weight={600} leading={1.2}>
                    {KIND_LABEL[v.kind]}
                  </Text>
                </View>
              </View>
              {v.memo && (
                <Text size={13} leading={1.6} color={colors.body}>
                  {v.memo}
                </Text>
              )}
            </View>
          </Pressable>
        ))}
        {visits.length > 3 && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setAllVisits((v) => !v)}
            style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text size={13} weight={600}>
              {allVisits ? '最近の記録だけ表示' : `すべての記録（${visits.length}件）`}
            </Text>
          </Pressable>
        )}
      </View>

      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={station.name}
        actions={[
          {
            label: excluded ? '自動記録の除外をやめる' : '自動記録から除外する',
            onPress: () => mutate((db) => setExcluded(db, stationId, !excluded)),
          },
        ]}
      />
      <ActionSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? (editing.visitedOn ? formatLong(editing.visitedOn) : '日付なしの記録') : undefined}
        actions={visitActions}
      />
    </StackScreen>
  );
}

function SummaryCell({ label, first, children }: { label: string; first?: boolean; children: React.ReactNode }) {
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: 16,
        paddingLeft: first ? 0 : 14,
        borderLeftWidth: first ? 0 : 1,
        borderLeftColor: colors.hairline,
        gap: 6,
      }}>
      <Text size={11} weight={500} color={colors.sub}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function groupByOperator(lines: StationLine[]): { operator: string; lines: StationLine[] }[] {
  const out: { operator: string; lines: StationLine[] }[] = [];
  for (const sl of lines) {
    const g = out.find((x) => x.operator === sl.line.operatorName);
    if (g) g.lines.push(sl);
    else out.push({ operator: sl.line.operatorName, lines: [sl] });
  }
  return out;
}
