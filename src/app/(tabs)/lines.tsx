/** 05 路線 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LineInfo } from '@/data/master';
import { getLineStats } from '@/db/queries';
import { useLive, useMaster, useSettings } from '@/db/provider';
import { Icon } from '@/ui/Icon';
import { LineMark } from '@/ui/LineMark';
import { SearchField } from '@/ui/SearchField';
import { Text } from '@/ui/Text';
import { IconButton, ProgressBar, Segmented } from '@/ui/controls';
import { colors } from '@/ui/theme';

type Filter = 'all' | 'progress' | 'done';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'すべて' },
  { id: 'progress', label: '進行中' },
  { id: 'done', label: '制覇' },
];

type Row = { line: LineInfo; visited: number; total: number };

export default function LinesScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ filter?: string }>();
  const master = useMaster();
  const [settings] = useSettings();
  const stats = useLive((db) => getLineStats(db, settings.countPass), [settings.countPass]);
  const [filter, setFilter] = useState<Filter>('all');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (params.filter === 'done' || params.filter === 'progress' || params.filter === 'all') {
      setFilter(params.filter);
    }
  }, [params.filter]);

  const { sections, visitedCount, doneCount } = useMemo(() => {
    const q = query.trim();
    const rows: Row[] = [...master.lines.values()]
      .sort((a, b) => a.sort - b.sort)
      .map((line) => {
        const s = stats.get(line.id);
        return { line, visited: s?.visited ?? 0, total: s?.total ?? line.stationCount };
      });
    const visitedCount = rows.filter((r) => r.visited > 0).length;
    const doneCount = rows.filter((r) => r.visited >= r.total && r.total > 0).length;
    const shown = rows.filter((r) => {
      const done = r.visited >= r.total;
      if (filter === 'progress' && (done || r.visited === 0)) return false;
      if (filter === 'done' && !done) return false;
      if (q === '') return true;
      return (
        r.line.name.includes(q) ||
        r.line.operatorName.includes(q) ||
        (r.line.code ?? '').toLowerCase() === q.toLowerCase()
      );
    });
    const groups = new Map<string, Row[]>();
    for (const r of shown) {
      if (!groups.has(r.line.operatorName)) groups.set(r.line.operatorName, []);
      groups.get(r.line.operatorName)!.push(r);
    }
    // 訪れたことのある事業者を先に出す
    const sections = [...groups.entries()]
      .map(([title, data]) => ({ title, data, any: data.some((r) => r.visited > 0) }))
      .sort((a, b) => Number(b.any) - Number(a.any));
    return { sections, visitedCount, doneCount };
  }, [master, stats, filter, query]);

  return (
    <SectionList
      testID="lines-screen"
      style={{ flex: 1, backgroundColor: colors.white }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 24 }}
      sections={sections}
      keyExtractor={(r) => String(r.line.id)}
      stickySectionHeadersEnabled={false}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={14}
      ListHeaderComponent={
        <View style={{ gap: 22, marginBottom: 22 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ gap: 4 }}>
              <Text size={20} weight={700} accessibilityRole="header">
                路線
              </Text>
              <Text size={12} color={colors.sub}>
                {visitedCount}路線に訪問 · {doneCount}路線を制覇
              </Text>
            </View>
            <IconButton
              testID="lines-search-toggle"
              icon={searching ? 'close' : 'search'}
              label={searching ? '検索を閉じる' : '路線を検索'}
              filled
              size={20}
              onPress={() => {
                setSearching((v) => !v);
                setQuery('');
              }}
            />
          </View>
          {searching && (
            <SearchField testID="lines-search" value={query} onChangeText={setQuery} placeholder="路線名・会社名で検索" autoFocus />
          )}
          <Segmented options={FILTERS} value={filter} onChange={setFilter} label="絞り込み" height={38} fontSize={13} />
        </View>
      }
      ListEmptyComponent={
        <Text size={13} leading={1.6} color={colors.sub}>
          {filter === 'done'
            ? 'まだ制覇した路線はありません。全駅を訪れると、ここに並びます。'
            : filter === 'progress'
              ? '進行中の路線はありません。駅を記録すると、ここに並びます。'
              : '合う路線が見つかりません。'}
        </Text>
      }
      renderSectionHeader={({ section }) => (
        <Text size={11} weight={600} color={colors.sub} tracking={0.04} style={{ marginTop: 14, marginBottom: 2 }}>
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => <LineRow row={item} />}
    />
  );
}

function LineRow({ row }: { row: Row }) {
  const { line, visited, total } = row;
  const done = total > 0 && visited >= total;
  return (
    <Pressable
      testID={`line-${line.name}`}
      accessibilityRole="button"
      onPress={() => router.push(`/line/${line.id}`)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.hairline,
      }}>
      <LineMark line={line} number="" size={40} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <Text size={15} weight={600} style={{ flex: 1 }} numberOfLines={1}>
            {line.name}
          </Text>
          {done ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="check" size={14} strokeWidth={2.4} />
              <Text size={12} weight={700}>
                制覇
              </Text>
            </View>
          ) : (
            <Text size={12} weight={600} tabular>
              {visited}
              <Text size={12} weight={500} color={colors.sub}>
                {' / '}
                {total}駅
              </Text>
            </Text>
          )}
        </View>
        <ProgressBar value={total > 0 ? visited / total : 0} color={line.color ?? colors.ink} height={4} />
      </View>
      <Icon name="chevron-right" size={18} color={colors.mute} />
    </Pressable>
  );
}
