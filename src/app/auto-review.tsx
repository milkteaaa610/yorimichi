/** 08 自動チェックインの確認 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { dismissCandidate, getPendingCandidates, getVisitCounts, recordCandidate } from '@/db/queries';
import type { VisitKind } from '@/db/schema';
import { useLive, useMaster, useMutate } from '@/db/provider';
import { KIND_LABEL, formatMonthDay, formatTime, toDateKey } from '@/lib/date';
import { Icon } from '@/ui/Icon';
import { BadgeRow } from '@/ui/NumberingBadge';
import { HeaderBar, StackScreen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Checkbox, IconButton, Note, PrimaryButton, Tag } from '@/ui/controls';
import { colors } from '@/ui/theme';

const NEXT: Record<VisitKind, VisitKind> = { got_off: 'transfer', transfer: 'pass', pass: 'got_off' };

export default function AutoReviewScreen() {
  const master = useMaster();
  const mutate = useMutate();
  const pending = useLive((db) => getPendingCandidates(db));
  const counts = useLive((db) => getVisitCounts(db, pending.map((p) => p.stationId)), [pending]);
  const [kinds, setKinds] = useState<Record<number, VisitKind>>({});
  const [off, setOff] = useState<Set<number>>(new Set());

  const rows = pending.map((c) => ({ ...c, kind: kinds[c.id] ?? c.kindGuess, on: !off.has(c.id) }));
  const count = rows.filter((r) => r.on).length;

  // すべての駅が同じ路線なら、時刻の線をその路線の色にし、バッジもその路線のものを出す
  const commonLine = useMemo(() => {
    const sets = pending.map((p) => new Set(master.stationLines(p.stationId).map((l) => l.line.id)));
    if (sets.length === 0) return undefined;
    const id = [...sets[0]].find((lineId) => sets.every((s) => s.has(lineId)));
    return id === undefined ? undefined : master.lines.get(id);
  }, [pending, master]);
  const lineColor = commonLine?.color ?? colors.ink;

  const summary = useMemo(() => {
    if (pending.length === 0) return '';
    const first = pending[0];
    const last = pending[pending.length - 1];
    const day = formatMonthDay(toDateKey(new Date(last.detectedAt)));
    const a = master.station(first.stationId)?.name ?? '';
    const b = master.station(last.stationId)?.name ?? '';
    const route = a === b ? a : `${a} → ${b}`;
    return [day, route, commonLine?.name].filter(Boolean).join(' · ');
  }, [pending, master, commonLine]);


  const submit = () => {
    mutate((db) => {
      for (const r of rows) {
        if (r.on) recordCandidate(db, r.id, r.kind);
        else dismissCandidate(db, r.id);
      }
    });
    router.back();
  };

  return (
    <StackScreen
      testID="auto-review-screen"
      gap={22}
      header={
        <HeaderBar
          left={<IconButton icon="chevron-left" label="戻る" onPress={() => router.back()} />}
          right={<IconButton icon="sliders" label="自動チェックインの設定" onPress={() => router.push('/settings')} />}
        />
      }
      footer={
        pending.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={{
                height: 54, paddingHorizontal: 22, borderRadius: 999, backgroundColor: colors.surface,
                justifyContent: 'center',
              }}>
              <Text size={15} weight={600}>
                あとで
              </Text>
            </Pressable>
            <PrimaryButton
              testID="auto-review-submit"
              style={{ flex: 1 }}
              label={count > 0 ? `${count}駅を記録する` : '駅を選んでください'}
              disabled={count === 0 && rows.length === 0}
              onPress={submit}
            />
          </View>
        ) : undefined
      }>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="signal" size={14} color={colors.sub} strokeWidth={2} />
          <Text size={12} weight={600} color={colors.sub}>
            自動チェックイン
          </Text>
        </View>
        <Text size={26} weight={700} leading={1.3} accessibilityRole="header">
          見つけた駅
        </Text>
        {summary !== '' && (
          <Text size={13} color={colors.sub}>
            {summary}
          </Text>
        )}
      </View>

      {pending.length === 0 ? (
        <Note>確認待ちの駅はありません。自動チェックインで見つけた駅は、ここと通知に出ます。</Note>
      ) : (
        <View>
          {rows.map((r, i) => {
            const s = master.station(r.stationId);
            if (!s) return null;
            const filled = r.kind !== 'pass';
            const first = (counts.get(r.stationId) ?? 0) === 0;
            const detail =
              r.kindGuess === 'pass' ? '止まらずに通過' : `${Math.max(1, Math.round(r.dwellSec / 60))}分滞在`;
            return (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'stretch', gap: 10, minHeight: 84 }}>
                <Text size={12} weight={600} color={colors.body} tabular style={{ width: 40, paddingTop: 17 }}>
                  {formatTime(r.detectedAt)}
                </Text>
                <View style={{ width: 16 }}>
                  {i > 0 && (
                    <View style={{ position: 'absolute', left: 6, width: 4, top: 0, height: 26, backgroundColor: lineColor }} />
                  )}
                  {i < rows.length - 1 && (
                    <View style={{ position: 'absolute', left: 6, width: 4, top: 26, bottom: 0, backgroundColor: lineColor }} />
                  )}
                  <View
                    style={{
                      position: 'absolute', left: 0, top: 18, width: 16, height: 16, borderRadius: 999,
                      backgroundColor: filled ? colors.ink : colors.white,
                      borderWidth: filled ? 3 : 2.5,
                      borderColor: filled ? colors.white : lineColor,
                    }}
                  />
                </View>
                <View
                  style={{
                    flex: 1, paddingTop: 13, paddingBottom: 14, borderBottomWidth: 1,
                    borderBottomColor: colors.hairline, gap: 9,
                  }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <Text size={16} weight={700} color={r.on ? colors.ink : colors.sub}>
                      {s.name}
                    </Text>
                    <BadgeRow badges={master.badges(s.id, commonLine?.id)} max={1} showMore={false} />
                    {first && <Tag label="はじめて" />}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Pressable
                      testID={`kind-${s.name}`}
                      accessibilityRole="button"
                      accessibilityLabel={`記録の種類：${KIND_LABEL[r.kind]}（タップで変更）`}
                      onPress={() => setKinds((k) => ({ ...k, [r.id]: NEXT[r.kind] }))}
                      style={{
                        height: 30, paddingLeft: 11, paddingRight: 8, borderRadius: 999, borderWidth: 1,
                        borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 3,
                      }}>
                      <Text size={12} weight={700}>
                        {KIND_LABEL[r.kind]}
                      </Text>
                      <Icon name="chevron-down" size={14} strokeWidth={2} />
                    </Pressable>
                    <Text size={12} color={colors.sub}>
                      {detail}
                    </Text>
                  </View>
                </View>
                <View style={{ alignSelf: 'center' }}>
                  <Checkbox
                    label={`${s.name}を記録する`}
                    checked={r.on}
                    onChange={() =>
                      setOff((cur) => {
                        const next = new Set(cur);
                        if (next.has(r.id)) next.delete(r.id);
                        else next.add(r.id);
                        return next;
                      })
                    }
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {pending.length > 0 && (
        <Note>位置情報と移動の速さから判定しています。種類をタップすると変更でき、チェックを外した駅は記録しません。</Note>
      )}
    </StackScreen>
  );
}
