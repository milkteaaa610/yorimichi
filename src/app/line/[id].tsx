/** 06 路線の詳細・まとめて登録 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type LineStation, addVisitsBulk, getLineStations } from '@/db/queries';
import { useLive, useMaster, useMutate, useSettings } from '@/db/provider';
import { Icon } from '@/ui/Icon';
import { LineMark } from '@/ui/LineMark';
import { NumberingBadge } from '@/ui/NumberingBadge';
import { HeaderBar } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Checkbox, IconButton, Note, ProgressBar } from '@/ui/controls';
import { colors } from '@/ui/theme';

const ROW_H = 56;

export default function LineScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lineId = Number(id);
  const master = useMaster();
  const mutate = useMutate();
  const [settings] = useSettings();
  const line = master.lines.get(lineId);
  const stations = useLive((db) => getLineStations(db, lineId, settings.countPass), [lineId, settings.countPass]);
  const [selecting, setSelecting] = useState(false);
  const [pending, setPending] = useState<Set<number>>(new Set());

  const visitedCount = useMemo(() => stations.filter((s) => s.visited).length, [stations]);
  const total = stations.length;
  const pendingCount = selecting ? pending.size : 0;
  const color = line?.color ?? '#8A8A86';

  if (!line) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.white, paddingTop: insets.top + 4, paddingHorizontal: 12 }}>
        <HeaderBar left={<IconButton icon="chevron-left" label="戻る" onPress={() => router.back()} />} />
      </View>
    );
  }

  const toggle = (stationId: number) =>
    setPending((cur) => {
      const next = new Set(cur);
      if (next.has(stationId)) next.delete(stationId);
      else next.add(stationId);
      return next;
    });

  const commit = () => {
    if (pending.size === 0) return;
    // 路線の並び順で登録する
    const ids = stations.filter((s) => pending.has(s.stationId)).map((s) => s.stationId);
    mutate((db) => addVisitsBulk(db, ids));
    setPending(new Set());
    setSelecting(false);
  };

  const first = stations[0];
  const meta = [line.operatorName, `${total}駅`, line.isLoop ? '環状運転' : null].filter(Boolean).join(' · ');

  return (
    <View testID="line-screen" style={{ flex: 1, backgroundColor: colors.white }}>
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 12 }}>
        <HeaderBar
          left={<IconButton icon="chevron-left" label="路線一覧に戻る" onPress={() => router.back()} />}
          right={
            <Pressable
              testID="bulk-toggle"
              accessibilityRole="button"
              onPress={() => {
                setSelecting((v) => !v);
                setPending(new Set());
              }}
              style={{
                height: 36,
                marginRight: 8,
                paddingHorizontal: 14,
                borderRadius: 999,
                justifyContent: 'center',
                backgroundColor: selecting ? colors.surface : colors.ink,
              }}>
              <Text size={13} weight={700} color={selecting ? colors.ink : colors.white}>
                {selecting ? 'キャンセル' : 'まとめて登録'}
              </Text>
            </Pressable>
          }
        />
      </View>

      <FlatList
        data={stations}
        keyExtractor={(s) => String(s.stationId)}
        extraData={[selecting, pending]}
        getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
        contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: 24 }}
        ListHeaderComponent={
          <View style={{ gap: 22, marginBottom: 22 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <LineMark line={line} number="" size={56} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text size={26} weight={700} leading={1.2} accessibilityRole="header">
                  {line.name}
                </Text>
                <Text size={12} color={colors.sub}>
                  {meta}
                </Text>
              </View>
            </View>
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text testID="line-visited" size={36} weight={600} tracking={-0.04} leading={1.1} tabular>
                    {visitedCount}
                  </Text>
                  <Text size={14} weight={600} color={colors.sub}>
                    / {total}駅
                  </Text>
                  {pendingCount > 0 && (
                    <View
                      style={{
                        marginLeft: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
                        backgroundColor: colors.ink, alignSelf: 'center',
                      }}>
                      <Text testID="pending-count" size={11} weight={700} color={colors.white} leading={1.2}>
                        +{pendingCount} 選択中
                      </Text>
                    </View>
                  )}
                </View>
                <Text size={13} weight={600} tabular>
                  {total > 0 ? Math.round((visitedCount / total) * 100) : 0}%
                </Text>
              </View>
              <ProgressBar
                value={total > 0 ? visitedCount / total : 0}
                color={color}
                label={`${total}駅のうち${visitedCount}駅を訪問`}
                extra={{ value: total > 0 ? pendingCount / total : 0, color: colors.ink }}
              />
              {selecting && (
                <View style={{ marginTop: 4 }}>
                  <Note>行ったことのある駅をタップして選んでください。日付がわからなくても登録できます。</Note>
                </View>
              )}
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <StationItem
            station={item}
            line={line}
            color={color}
            selecting={selecting}
            pending={pending.has(item.stationId)}
            isFirst={index === 0 || stations[index - 1].seg !== item.seg}
            isLast={
              (index === total - 1 && !line.isLoop) ||
              (index < total - 1 && stations[index + 1].seg !== item.seg)
            }
            onPress={() => {
              if (selecting && !item.visited) toggle(item.stationId);
              else if (!selecting) router.push(`/station/${item.stationId}`);
            }}
          />
        )}
        ListFooterComponent={
          line.isLoop && first ? (
            <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 20, alignSelf: 'stretch' }}>
                <View style={{ position: 'absolute', left: 8, width: 4, top: 0, height: 26, backgroundColor: color }} />
                <View
                  style={{ position: 'absolute', left: 4, top: 22, width: 12, height: 12, borderRadius: 999, backgroundColor: color }}
                />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="loop" size={14} color={colors.sub} />
                <Text size={12} color={colors.sub}>
                  {line.code ?? ''}
                  {first.number ?? ''} {first.name}へ戻る
                </Text>
              </View>
            </View>
          ) : undefined
        }
      />

      {selecting && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingTop: 12,
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom, 16),
            borderTopWidth: 1,
            borderTopColor: colors.hairline,
          }}>
          <Text size={14} weight={600}>
            {pending.size}駅を選択中
          </Text>
          <Pressable
            testID="bulk-commit"
            accessibilityRole="button"
            accessibilityState={{ disabled: pending.size === 0 }}
            disabled={pending.size === 0}
            onPress={commit}
            style={{
              height: 52,
              paddingHorizontal: 28,
              borderRadius: 999,
              justifyContent: 'center',
              backgroundColor: pending.size > 0 ? colors.ink : colors.disabled,
            }}>
            <Text size={15} weight={700} color={pending.size > 0 ? colors.white : colors.sub}>
              記録に追加
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function StationItem({
  station,
  line,
  color,
  selecting,
  pending,
  isFirst,
  isLast,
  onPress,
}: {
  station: LineStation;
  line: { code: string | null; ink: string | null; badgeStyle: string | null; badgeFont: string | null };
  color: string;
  selecting: boolean;
  pending: boolean;
  isFirst: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  const selectable = selecting && !station.visited;
  return (
    <Pressable
      testID={`line-station-${station.name}`}
      accessibilityRole={selectable ? 'checkbox' : 'button'}
      accessibilityState={selectable ? { checked: pending } : undefined}
      accessibilityLabel={`${station.name}${station.visited ? ' 訪問済み' : ''}`}
      onPress={onPress}
      style={{ height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 20, alignSelf: 'stretch' }}>
        <View
          style={{
            position: 'absolute',
            left: 8,
            width: 4,
            top: isFirst ? 28 : 0,
            bottom: isLast ? ROW_H - 28 : 0,
            backgroundColor: color,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 2,
            top: 20,
            width: 16,
            height: 16,
            borderRadius: 999,
            backgroundColor: station.visited ? colors.ink : colors.white,
            borderWidth: station.visited ? 3 : 2.5,
            borderColor: station.visited ? colors.white : selectable && pending ? colors.ink : color,
          }}
        />
      </View>
      {line.code && station.number ? (
        <NumberingBadge
          code={line.code}
          num={station.number}
          color={color}
          ink={line.ink}
          kind={line.badgeStyle}
          font={line.badgeFont}
          size={34}
        />
      ) : null}
      <Text size={15} weight={station.visited ? 600 : 500} style={{ flex: 1 }} numberOfLines={1}>
        {station.name}
      </Text>
      {station.visited && (
        <Text size={12} color={colors.sub}>
          訪問済み
        </Text>
      )}
      {selectable && <Checkbox checked={pending} label={station.name} />}
    </Pressable>
  );
}
