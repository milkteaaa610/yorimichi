/** 駅を検索（ホームの検索ボタンから） */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { getVisitCounts } from '@/db/queries';
import { useLive, useMaster } from '@/db/provider';
import { HeaderBar, StackScreen } from '@/ui/Screen';
import { SearchField } from '@/ui/SearchField';
import { RowMeta, StationRow } from '@/ui/StationRow';
import { Text } from '@/ui/Text';
import { IconButton } from '@/ui/controls';
import { colors } from '@/ui/theme';

export default function SearchScreen() {
  const master = useMaster();
  const [query, setQuery] = useState('');
  const results = useMemo(() => master.search(query, 40), [query, master]);
  const counts = useLive((db) => getVisitCounts(db, results.map((s) => s.id)), [results]);

  return (
    <StackScreen
      testID="search-screen"
      gap={8}
      header={
        <HeaderBar
          left={<IconButton icon="close" label="閉じる" onPress={() => router.back()} />}
          title={
            <Text size={16} weight={700} accessibilityRole="header">
              駅を検索
            </Text>
          }
        />
      }>
      <SearchField testID="search-input" value={query} onChangeText={setQuery} placeholder="駅名・よみがな・路線名" autoFocus />
      <View>
        {query.trim() === '' && (
          <Text size={13} leading={1.6} color={colors.sub} style={{ paddingVertical: 16 }}>
            駅名は漢字でもひらがなでも探せます。路線名を入れると、その路線の駅が並びます。
          </Text>
        )}
        {query.trim() !== '' && results.length === 0 && (
          <Text size={13} color={colors.sub} style={{ paddingVertical: 16 }}>
            「{query.trim()}」に合う駅が見つかりません
          </Text>
        )}
        {results.map((s) => {
          const n = counts.get(s.id) ?? 0;
          return (
            <StationRow
              key={s.id}
              testID={`search-result-${s.name}`}
              name={s.name}
              badges={master.badges(s.id)}
              sub={master.describe(s.id)}
              right={n > 0 ? <RowMeta top={`${n}回`} bottom="訪問済み" /> : undefined}
              onPress={() => router.push(`/station/${s.id}`)}
            />
          );
        })}
      </View>
    </StackScreen>
  );
}
