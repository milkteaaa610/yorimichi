/** すべての記録（ホームの「すべて見る」から） */
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getRecentVisits, getVisitCount } from '@/db/queries';
import { useLive, useMaster } from '@/db/provider';
import { KIND_LABEL, formatShort } from '@/lib/date';
import { HeaderBar } from '@/ui/Screen';
import { RowMeta, StationRow } from '@/ui/StationRow';
import { Text } from '@/ui/Text';
import { IconButton } from '@/ui/controls';
import { colors } from '@/ui/theme';

const PAGE = 50;

export default function VisitsScreen() {
  const insets = useSafeAreaInsets();
  const master = useMaster();
  const [limit, setLimit] = useState(PAGE);
  const total = useLive((db) => getVisitCount(db));
  const visits = useLive((db) => getRecentVisits(db, limit), [limit]);

  return (
    <View testID="visits-screen" style={{ flex: 1, backgroundColor: colors.white }}>
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 12 }}>
        <HeaderBar left={<IconButton icon="chevron-left" label="戻る" onPress={() => router.back()} />} />
      </View>
      <FlatList
        data={visits}
        keyExtractor={(v) => String(v.id)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
        onEndReached={() => visits.length < total && setLimit((n) => n + PAGE)}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={{ gap: 6, paddingTop: 8, paddingBottom: 12 }}>
            <Text size={26} weight={700} leading={1.2} accessibilityRole="header">
              すべての記録
            </Text>
            <Text size={13} color={colors.sub}>
              {total}件
            </Text>
          </View>
        }
        renderItem={({ item: v }) => {
          const station = master.station(v.stationId);
          if (!station) return null;
          return (
            <StationRow
              name={station.name}
              badges={master.badges(station.id)}
              sub={master.describe(station.id)}
              first={v.isFirst}
              right={<RowMeta top={v.visitedOn ? formatShort(v.visitedOn) : '日付なし'} bottom={KIND_LABEL[v.kind]} />}
              onPress={() => router.push(`/station/${station.id}`)}
            />
          );
        }}
      />
    </View>
  );
}
