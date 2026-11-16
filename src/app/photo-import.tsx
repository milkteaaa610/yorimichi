/** 10 写真から記録 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  MAX_PHOTOS_PER_VISIT,
  addPhotosToVisit,
  addVisit,
  findVisitOn,
  getStationVisits,
} from '@/db/queries';
import { useDb, useMaster, useMutate } from '@/db/provider';
import { formatLong, formatTime } from '@/lib/date';
import { type PhotoGroup, type PhotoInput, groupPhotosByStation } from '@/photos/infer';
import { pickPhotos, toStoredPhoto } from '@/photos/library';
import { Icon } from '@/ui/Icon';
import { BadgeRow } from '@/ui/NumberingBadge';
import { PhotoThumb } from '@/ui/PhotoThumb';
import { HeaderBar, StackScreen } from '@/ui/Screen';
import { SearchField } from '@/ui/SearchField';
import { StationRow } from '@/ui/StationRow';
import { Text } from '@/ui/Text';
import { Checkbox, IconButton, Note, PrimaryButton, Tag } from '@/ui/controls';
import { colors } from '@/ui/theme';

/** 一度に読む写真の上限。選んだ写真だけを読む。 */
const PICK_LIMIT = 300;

type Candidate = PhotoGroup & {
  /** 同じ日の記録がすでにある（写真だけ追加する） */
  existingVisitId: number | null;
  first: boolean;
};

export default function PhotoImportScreen() {
  const db = useDb();
  const master = useMaster();
  const mutate = useMutate();
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<PhotoInput[] | null>(null);
  const [groups, setGroups] = useState<PhotoGroup[]>([]);
  const [unmatched, setUnmatched] = useState<PhotoInput[]>([]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [choosing, setChoosing] = useState(false);

  const start = async () => {
    setLoading(true);
    try {
      const photos = await pickPhotos(PICK_LIMIT);
      if (photos.length === 0) return;
      const result = groupPhotosByStation(photos, (lat, lng) => {
        const hit = master.nearest(lat, lng, 1, 1)[0];
        return hit ? { stationId: hit.station.id, distance: hit.distance } : null;
      });
      setPicked(photos);
      setGroups(result.groups);
      setUnmatched(result.unmatched);
      setOff(new Set());
    } finally {
      setLoading(false);
    }
  };

  const candidates: Candidate[] = useMemo(
    () =>
      groups.map((g) => {
        const existing = g.dateKey
          ? findVisitOn(db, g.stationId, g.dateKey)
          : getStationVisits(db, g.stationId, 1)[0];
        return {
          ...g,
          existingVisitId: existing?.id ?? null,
          first: getStationVisits(db, g.stationId, 1).length === 0,
        };
      }),
    [groups, db],
  );

  const selected = candidates.filter((c) => !off.has(c.key));
  const newCount = selected.filter((c) => c.existingVisitId === null).length;
  const photoCount = selected.reduce((n, c) => n + c.photos.length, 0);
  const label =
    newCount > 0
      ? `${newCount}駅を記録・写真${photoCount}枚を追加`
      : photoCount > 0
        ? `写真${photoCount}枚を追加`
        : '駅を選んでください';

  const submit = () => {
    mutate((tx) => {
      for (const c of selected) {
        // 1件の記録に付けられる写真は10枚まで。多い日は、撮った順に10枚まで付ける
        const list = c.photos.slice(0, MAX_PHOTOS_PER_VISIT).map(toStoredPhoto);
        if (c.existingVisitId !== null) {
          addPhotosToVisit(tx, c.existingVisitId, list);
        } else {
          addVisit(tx, {
            stationId: c.stationId,
            kind: 'got_off',
            visitedOn: c.dateKey,
            source: 'photo',
            photos: list,
            createdAt: c.firstTakenAt ?? Date.now(),
          });
        }
      }
    });
    router.back();
  };

  /** 位置のない写真に、自分で駅を選ぶ。日付ごとに1件の候補にする。 */
  const assign = (stationId: number) => {
    setChoosing(false);
    const byDate = new Map<string, PhotoInput[]>();
    for (const p of unmatched) {
      const key = p.takenAt !== null ? new Date(p.takenAt).toDateString() : 'nodate';
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(p);
    }
    const added: PhotoGroup[] = [...byDate.values()].map((photos) => {
      const t = photos[0].takenAt;
      const d = t !== null ? new Date(t) : null;
      const dateKey = d
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        : null;
      return { key: `${stationId}:${dateKey ?? 'nodate'}:manual`, stationId, dateKey, firstTakenAt: t, photos };
    });
    setGroups((cur) => [...cur, ...added]);
    setUnmatched([]);
  };

  return (
    <StackScreen
      testID="photo-import-screen"
      gap={16}
      contentStyle={{ paddingTop: 12 }}
      header={
        <HeaderBar
          left={<IconButton icon="close" label="閉じる" onPress={() => router.back()} />}
          title={
            <Text size={16} weight={700} accessibilityRole="header">
              写真から記録
            </Text>
          }
        />
      }
      footer={
        picked ? (
          <PrimaryButton testID="photo-import-submit" label={label} disabled={photoCount === 0} onPress={submit} />
        ) : undefined
      }>
      {!picked ? (
        <View style={{ gap: 20, paddingTop: 12 }}>
          <View style={{ gap: 8 }}>
            <Text size={20} weight={700} leading={1.4}>
              写真の撮影場所から、{'\n'}訪れた駅を見つけます
            </Text>
            <Text size={13} leading={1.7} color={colors.body}>
              選んだ写真だけを読みます。撮影場所から半径300m以内の駅を探し、同じ日・同じ駅の写真は1件にまとめます。
            </Text>
          </View>
          <Note>写真は端末の写真ライブラリにあるものを指すだけで、アプリの外には送りません。</Note>
          <PrimaryButton testID="pick-photos" label={loading ? '読み込んでいます…' : '写真を選ぶ'} onPress={start} disabled={loading} />
          {loading && <ActivityIndicator color={colors.ink} />}
        </View>
      ) : (
        <>
          <View style={{ gap: 6, paddingBottom: 4 }}>
            <Text testID="photo-import-summary" size={20} weight={700} leading={1.4}>
              {picked.length}枚の写真から{'\n'}
              {candidates.length}駅が見つかりました
            </Text>
            <Text size={12} leading={1.6} color={colors.sub}>
              選んだ写真の撮影場所と日時から判定しています。記録したい駅を選んでください。
            </Text>
          </View>

          {candidates.map((c) => {
            const s = master.station(c.stationId);
            if (!s) return null;
            const on = !off.has(c.key);
            const date = c.dateKey ? formatLong(c.dateKey) : '日付なし';
            const time = c.firstTakenAt !== null ? ` ${formatTime(c.firstTakenAt)}` : '';
            const shown = Math.min(c.photos.length, MAX_PHOTOS_PER_VISIT);
            return (
              <View
                key={c.key}
                testID={`photo-group-${s.name}`}
                style={{
                  paddingVertical: 14, paddingLeft: 14, paddingRight: 6, borderRadius: 16,
                  borderWidth: on ? 1.5 : 1, borderColor: on ? colors.ink : colors.border, gap: 12,
                }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text size={12} color={colors.sub} tabular>
                      {date}
                      {time}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <Text size={17} weight={700} style={{ marginRight: 2 }}>
                        {s.name}
                      </Text>
                      <BadgeRow badges={master.badges(s.id)} />
                      {c.first && <Tag label="はじめて" />}
                      {c.existingVisitId !== null && <Tag label="記録済み" tone="light" />}
                    </View>
                    <Text size={12} color={colors.sub}>
                      {master.describe(s.id)}
                    </Text>
                  </View>
                  <Checkbox
                    label={`${s.name}を選ぶ`}
                    checked={on}
                    onChange={() =>
                      setOff((cur) => {
                        const next = new Set(cur);
                        if (next.has(c.key)) next.delete(c.key);
                        else next.add(c.key);
                        return next;
                      })
                    }
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {c.photos.slice(0, 4).map((p) => (
                    <PhotoThumb key={p.key} uri={p.uri} size={64} radius={10} />
                  ))}
                  {c.photos.length > 4 && (
                    <View
                      style={{
                        width: 64, height: 64, borderRadius: 10, backgroundColor: colors.surface,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                      <Text size={13} weight={700} color={colors.sub}>
                        +{c.photos.length - 4}
                      </Text>
                    </View>
                  )}
                </View>
                <Text size={12} color={colors.body}>
                  {c.existingVisitId !== null
                    ? `記録済みの訪問に写真${shown}枚を追加`
                    : `${c.dateKey ? formatLong(c.dateKey).replace(/（.）$/, '') + 'の訪問として' : '日付なしで'}記録・写真${shown}枚`}
                </Text>
              </View>
            );
          })}

          {unmatched.length > 0 && (
            <View
              testID="unmatched-photos"
              style={{ padding: 12, borderRadius: 16, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <PhotoThumb uri={unmatched[0].uri} size={44} radius={10} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text size={14} weight={700}>
                  位置情報のない写真 {unmatched.length}枚
                </Text>
                <Text size={12} color={colors.sub}>
                  駅を選ぶと記録に追加できます
                </Text>
              </View>
              <Pressable
                testID="assign-station"
                accessibilityRole="button"
                onPress={() => setChoosing(true)}
                style={{
                  height: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1,
                  borderColor: colors.borderStrong, backgroundColor: colors.white, justifyContent: 'center',
                }}>
                <Text size={13} weight={700}>
                  駅を選ぶ
                </Text>
              </Pressable>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={start}
            style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
            <Icon name="photo" size={16} />
            <Text size={13} weight={600}>
              写真を選び直す
            </Text>
          </Pressable>
        </>
      )}

      <StationPicker visible={choosing} onClose={() => setChoosing(false)} onPick={assign} />
    </StackScreen>
  );
}

function StationPicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (stationId: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const master = useMaster();
  const [query, setQuery] = useState('');
  const results = useMemo(() => master.search(query, 30), [query, master]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: colors.white, paddingTop: insets.top + 4, paddingHorizontal: 20, gap: 8 }}>
        <HeaderBar
          left={<IconButton icon="close" label="閉じる" onPress={onClose} />}
          title={
            <Text size={16} weight={700}>
              駅を選ぶ
            </Text>
          }
        />
        <SearchField testID="picker-search" value={query} onChangeText={setQuery} placeholder="駅名・路線名で検索" autoFocus />
        <View style={{ flex: 1 }}>
          {results.map((s) => (
            <StationRow
              key={s.id}
              testID={`picker-${s.name}`}
              name={s.name}
              badges={master.badges(s.id)}
              sub={master.describe(s.id)}
              onPress={() => {
                setQuery('');
                onPick(s.id);
              }}
            />
          ))}
        </View>
      </View>
    </Modal>
  );
}
