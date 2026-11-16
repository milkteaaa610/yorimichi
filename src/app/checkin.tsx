/** 02 駅を記録 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { MAX_PHOTOS_PER_VISIT, addVisit, getVisitCounts } from '@/db/queries';
import { useLive, useMaster, useMutate, useSettings } from '@/db/provider';
import type { VisitKind } from '@/db/schema';
import { formatDistance } from '@/geo/distance';
import { useCurrentLocation } from '@/geo/useCurrentLocation';
import { isToday, todayKey } from '@/lib/date';
import type { PhotoInput } from '@/photos/infer';
import { findPhotosNear, pickPhotos, toStoredPhoto } from '@/photos/library';
import { DateField } from '@/ui/DateField';
import { Icon } from '@/ui/Icon';
import { BadgeRow } from '@/ui/NumberingBadge';
import { PhotoThumb } from '@/ui/PhotoThumb';
import { HeaderBar, StackScreen } from '@/ui/Screen';
import { SearchField } from '@/ui/SearchField';
import { StationRow } from '@/ui/StationRow';
import { Text } from '@/ui/Text';
import { IconButton, PrimaryButton, Segmented } from '@/ui/controls';
import { JP_FONT, colors } from '@/ui/theme';

const KINDS: { id: VisitKind; label: string; hint: string }[] = [
  { id: 'got_off', label: '降りた', hint: '改札を出た、またはホームに降りた駅' },
  { id: 'transfer', label: '乗り換え', hint: '乗り換えで立ち寄った駅' },
  { id: 'pass', label: '通過', hint: '乗ったまま通り過ぎた駅（達成率には含めない設定も可）' },
];

export default function CheckinScreen() {
  const params = useLocalSearchParams<{ stationId?: string; date?: string }>();
  const master = useMaster();
  const mutate = useMutate();
  const [settings] = useSettings();
  const location = useCurrentLocation();

  const [query, setQuery] = useState('');
  // 自分で選んだ駅。選ぶまでは、現在地にいちばん近い駅を選んでいることにする
  const [pickedId, setPickedId] = useState<number | null>(params.stationId ? Number(params.stationId) : null);
  const [kind, setKind] = useState<VisitKind>('got_off');
  const [dateKey, setDateKey] = useState(params.date ?? todayKey());
  const [memo, setMemo] = useState('');
  const [photos, setPhotos] = useState<PhotoInput[]>([]);
  const [suggestion, setSuggestion] = useState<{ key: string; photos: PhotoInput[] }>({ key: '', photos: [] });

  const nearby = useMemo(
    () => (location.coords ? master.nearest(location.coords.lat, location.coords.lng, 3, 50) : []),
    [location.coords, master],
  );

  const selectedId = pickedId ?? nearby[0]?.station.id ?? null;
  const setSelectedId = setPickedId;

  const selected = selectedId !== null ? master.station(selectedId) : undefined;
  const options = useMemo(() => {
    const list = nearby.map((n) => ({ station: n.station, distance: n.distance as number | null }));
    if (selected && !list.some((o) => o.station.id === selected.id)) {
      list.unshift({ station: selected, distance: null });
    }
    return list;
  }, [nearby, selected]);
  const counts = useLive(
    (db) => getVisitCounts(db, options.map((o) => o.station.id)),
    [options.map((o) => o.station.id).join(',')],
  );
  const results = useMemo(() => (query.trim() ? master.search(query, 20) : []), [query, master]);

  // その日に駅の近くで撮った写真を、添付の候補として探す（駅・日付・添付済みの写真が変わったら探し直す）
  const photoKeys = photos.map((p) => p.key).join('|');
  const suggestKey = settings.suggestPhotos && selected ? `${selected.id}|${dateKey}|${photoKeys}` : '';
  useEffect(() => {
    if (suggestKey === '' || !selected) return;
    let alive = true;
    findPhotosNear(selected, dateKey, new Set(photoKeys.split('|'))).then((found) => {
      if (alive) setSuggestion({ key: suggestKey, photos: found });
    });
    return () => {
      alive = false;
    };
  }, [suggestKey, selected, dateKey, photoKeys]);
  const suggested = suggestion.key === suggestKey ? suggestion.photos : [];

  const room = MAX_PHOTOS_PER_VISIT - photos.length;
  const addPhotos = (list: PhotoInput[]) => {
    setPhotos((cur) => {
      const have = new Set(cur.map((p) => p.key));
      return [...cur, ...list.filter((p) => !have.has(p.key))].slice(0, MAX_PHOTOS_PER_VISIT);
    });
  };

  const submit = () => {
    if (!selected) return;
    mutate((db) =>
      addVisit(db, {
        stationId: selected.id,
        kind,
        visitedOn: dateKey,
        source: 'manual',
        memo,
        photos: photos.map(toStoredPhoto),
      }),
    );
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const nearestMuni = nearby[0] ? master.muniName(nearby[0].station.muniCode) : '';

  return (
    <StackScreen
      testID="checkin-screen"
      gap={28}
      contentStyle={{ paddingTop: 12, paddingBottom: 24 }}
      header={
        <HeaderBar
          left={<IconButton icon="close" label="閉じる" onPress={() => router.back()} testID="checkin-close" />}
          title={
            <Text size={16} weight={700} accessibilityRole="header">
              駅を記録
            </Text>
          }
        />
      }
      footer={
        <PrimaryButton
          testID="checkin-submit"
          label={selected ? `${selected.name}を記録する` : '駅を選んでください'}
          disabled={!selected}
          onPress={submit}
        />
      }>
      <SearchField
        testID="checkin-search"
        value={query}
        onChangeText={setQuery}
        placeholder="駅名・路線名で検索"
      />

      {query.trim() !== '' ? (
        <View testID="search-results" style={{ marginTop: -16 }}>
          {results.length === 0 && (
            <Text size={13} color={colors.sub} style={{ paddingVertical: 16 }}>
              「{query.trim()}」に合う駅が見つかりません
            </Text>
          )}
          {results.map((s) => (
            <StationRow
              key={s.id}
              testID={`result-${s.name}`}
              name={s.name}
              badges={master.badges(s.id)}
              sub={master.describe(s.id)}
              onPress={() => {
                setSelectedId(s.id);
                setQuery('');
              }}
            />
          ))}
        </View>
      ) : (
        <>
          <Pressable
            testID="open-photo-import"
            accessibilityRole="button"
            onPress={() => router.push('/photo-import')}
            style={{
              marginTop: -18,
              minHeight: 56,
              paddingVertical: 8,
              paddingLeft: 14,
              paddingRight: 12,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}>
            <Icon name="photo" size={20} strokeWidth={1.7} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text size={14} weight={600}>
                写真から記録
              </Text>
              <Text size={11} color={colors.sub}>
                撮影場所と日時から、過去に訪れた駅を見つけます
              </Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.mute} />
          </Pressable>

          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text size={13} weight={700} accessibilityRole="header">
                {nearby.length > 0 ? '現在地の近く' : '記録する駅'}
              </Text>
              {nearestMuni !== '' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="pin" size={14} color={colors.sub} />
                  <Text size={12} color={colors.sub}>
                    {nearestMuni}
                  </Text>
                </View>
              )}
            </View>
            {options.length === 0 && (
              <View style={{ padding: 14, borderRadius: 14, backgroundColor: colors.surface, gap: 8 }}>
                <Text size={13} leading={1.6} color={colors.body}>
                  {location.status === 'loading'
                    ? '現在地を確認しています…'
                    : location.status === 'denied'
                      ? '位置情報がオフのため、近くの駅を出せません。上の検索から駅を選べば、そのまま記録できます。'
                      : '現在地がわかりません。上の検索から駅を選んでください。'}
                </Text>
                {location.status !== 'loading' && (
                  <Pressable accessibilityRole="button" onPress={location.retry} style={{ alignSelf: 'flex-start' }}>
                    <Text size={13} weight={700}>
                      もう一度試す
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
            <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
              {options.map(({ station, distance }) => {
                const on = station.id === selectedId;
                const n = counts.get(station.id) ?? 0;
                return (
                  <Pressable
                    key={station.id}
                    testID={`option-${station.name}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => setSelectedId(station.id)}
                    style={{
                      minHeight: 64,
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      borderRadius: 16,
                      borderWidth: on ? 1.5 : 1,
                      borderColor: on ? colors.ink : colors.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}>
                    <View
                      style={{
                        width: 22, height: 22, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
                        borderWidth: on ? 2 : 1.5, borderColor: on ? colors.ink : colors.control,
                      }}>
                      {on && <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: colors.ink }} />}
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text size={16} weight={700}>
                          {station.name}
                        </Text>
                        <BadgeRow badges={master.badges(station.id)} />
                      </View>
                      <Text size={12} color={colors.sub} numberOfLines={1}>
                        {lineLabel(master, station.id)} · {n > 0 ? `訪問済み ${n}回` : 'はじめて'}
                      </Text>
                    </View>
                    {distance !== null && (
                      <Text size={12} weight={600} color={colors.sub} tabular>
                        {formatDistance(distance)}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Text size={13} weight={700} accessibilityRole="header">
              記録の種類
            </Text>
            <Segmented options={KINDS} value={kind} onChange={setKind} label="記録の種類" />
            <Text size={12} color={colors.sub}>
              {KINDS.find((k) => k.id === kind)?.hint}
            </Text>
          </View>

          <DateField value={dateKey} onChange={setDateKey} />

          <View style={{ gap: 10 }}>
            <Text size={13} weight={700}>
              メモ
            </Text>
            <TextInput
              testID="checkin-memo"
              value={memo}
              onChangeText={setMemo}
              placeholder="思い出をひとこと（任意）"
              placeholderTextColor={colors.sub}
              accessibilityLabel="メモ"
              multiline
              numberOfLines={3}
              style={{
                minHeight: 96,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                fontFamily: JP_FONT[400],
                fontSize: 15,
                lineHeight: 24,
                color: colors.ink,
                textAlignVertical: 'top',
              }}
            />
          </View>

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Text size={13} weight={700} accessibilityRole="header">
                写真
              </Text>
              <Text size={12} color={colors.sub} tabular>
                {photos.length} / {MAX_PHOTOS_PER_VISIT}枚
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {photos.map((p, i) => (
                <View key={p.key} style={{ width: 76, height: 76 }}>
                  <PhotoThumb uri={p.uri} size={76} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${i + 1}枚目の写真を外す`}
                    onPress={() => setPhotos((cur) => cur.filter((q) => q.key !== p.key))}
                    style={{
                      position: 'absolute', top: -8, right: -8, width: 44, height: 44,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                    <View
                      style={{
                        width: 22, height: 22, borderRadius: 999, backgroundColor: 'rgba(24,24,27,0.8)',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                      <Icon name="close" size={12} color={colors.white} strokeWidth={2.6} />
                    </View>
                  </Pressable>
                </View>
              ))}
              {room > 0 && (
                <Pressable
                  testID="add-photo"
                  accessibilityRole="button"
                  onPress={() => pickPhotos(room).then(addPhotos)}
                  style={{
                    width: 76, height: 76, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed',
                    borderColor: colors.control, alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}>
                  <Icon name="camera" size={20} color={colors.sub} strokeWidth={1.7} />
                  <Text size={10} weight={500} color={colors.sub}>
                    写真を追加
                  </Text>
                </Pressable>
              )}
            </View>
            {suggested.length > 0 && room > 0 && (
              <Pressable
                testID="add-suggested"
                accessibilityRole="button"
                onPress={() => addPhotos(suggested)}
                style={{
                  minHeight: 56, paddingVertical: 10, paddingLeft: 10, paddingRight: 14, borderRadius: 14,
                  backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12,
                }}>
                <View style={{ flexDirection: 'row' }}>
                  {suggested.slice(0, 3).map((p, i) => (
                    <View
                      key={p.key}
                      style={{ marginLeft: i === 0 ? 0 : -10, borderWidth: 2, borderColor: colors.surface, borderRadius: 8 }}>
                      <PhotoThumb uri={p.uri} size={26} radius={6} />
                    </View>
                  ))}
                </View>
                <Text size={12} leading={1.5} color={colors.body} style={{ flex: 1 }}>
                  {isToday(dateKey) ? '今日' : 'この日に'}この駅の近くで撮った写真が{suggested.length}枚あります
                </Text>
                <Text size={13} weight={700}>
                  追加
                </Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </StackScreen>
  );
}

/** 駅の路線名。1路線ならその名前、複数なら事業者をまとめて出す。 */
function lineLabel(master: ReturnType<typeof useMaster>, stationId: number): string {
  const lines = master.stationLines(stationId);
  if (lines.length === 1) return lines[0].line.name;
  const operators = [...new Set(lines.map((l) => l.line.operatorName))];
  if (operators.length === 1) return operators[0];
  return `${operators.slice(0, 2).join('・')}${operators.length > 2 ? ' ほか' : ''}`;
}
