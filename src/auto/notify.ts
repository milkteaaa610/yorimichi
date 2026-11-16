/**
 * 自動チェックインの通知（docs/SPEC.md 4.6）。
 * ボタン付きの通知（通知カテゴリ）で、アプリを開かずに「記録する／乗り換え／記録しない」を選べる。
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import type { MasterData } from '../data/master';
import { getVisitCounts } from '../db/queries';
import type { Db } from '../db/types';
import type { DetectedCandidate } from './session';

export const CATEGORY_ID = 'station-candidate';
export const CHANNEL_ID = 'auto-checkin';
export const ACTION_RECORD = 'record';
export const ACTION_TRANSFER = 'transfer';
export const ACTION_DISMISS = 'dismiss';

let prepared = false;

/** 通知の種類とボタンを登録する。何度呼んでもよい。 */
export async function prepareNotifications(): Promise<void> {
  if (prepared || Platform.OS === 'web') return;
  prepared = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '自動チェックイン',
      description: '駅に着いたことを見つけたときの通知',
      importance: AndroidImportance.HIGH,
    });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    { identifier: ACTION_RECORD, buttonTitle: '記録する', options: { opensAppToForeground: false } },
    { identifier: ACTION_TRANSFER, buttonTitle: '乗り換え', options: { opensAppToForeground: false } },
    {
      identifier: ACTION_DISMISS,
      buttonTitle: '記録しない',
      options: { opensAppToForeground: false, isDestructive: true },
    },
  ]);
}

export async function notificationsAllowed(request: boolean): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!request || !current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** 通知の文面（テストしやすいよう、組み立てだけを分けてある）。 */
export function candidateMessage(
  master: MasterData,
  c: Pick<DetectedCandidate, 'stationId' | 'kind' | 'visitId'>,
  visitCount: number,
): { title: string; body: string } {
  const s = master.station(c.stationId);
  const name = s?.name ?? '駅';
  const lines = master.stationLines(c.stationId);
  const lineName = lines.length === 1 ? lines[0].line.name : master.describe(c.stationId).split(' · ')[0];
  // まだ記録していなければ、今回がはじめて
  const first = c.visitId === null ? visitCount === 0 : visitCount <= 1;
  const fact = first ? 'はじめての駅です' : `${c.visitId === null ? visitCount + 1 : visitCount}回目の訪問です`;
  if (c.visitId !== null) {
    const verb = c.kind === 'transfer' ? 'での乗り換えを記録しました' : 'を記録しました';
    return { title: `${name}${verb}`, body: `${lineName} · ${fact}。あとから編集・削除できます。` };
  }
  const title = c.kind === 'transfer' ? `${name}で乗り換えました` : c.kind === 'pass' ? `${name}を通過しました` : `${name}に着きました`;
  return { title, body: `${lineName} · ${fact}。記録しますか？` };
}

export async function notifyCandidates(db: Db, master: MasterData, list: DetectedCandidate[]): Promise<void> {
  if (list.length === 0 || !(await notificationsAllowed(false))) return;
  await prepareNotifications();
  const counts = getVisitCounts(db, list.map((c) => c.stationId));
  const passes = list.filter((c) => c.kind === 'pass' && c.visitId === null);
  const others = list.filter((c) => !passes.includes(c));
  for (const c of others) {
    const { title, body } = candidateMessage(master, c, counts.get(c.stationId) ?? 0);
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { candidateId: c.candidateId, url: '/auto-review' },
        categoryIdentifier: c.visitId === null ? CATEGORY_ID : undefined,
      },
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
    });
  }
  // 通過した駅は1通にまとめる
  if (passes.length > 0) {
    const names = passes.map((c) => master.station(c.stationId)?.name ?? '').filter(Boolean);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `通過した${passes.length}駅を見つけました`,
        body: `${names.join('・')} · タップして確認`,
        data: { url: '/auto-review' },
      },
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
    });
  }
}

/** 通知への応答を、記録の操作に読みかえる。 */
export function actionOf(actionIdentifier: string): 'record' | 'transfer' | 'dismiss' | 'open' {
  if (actionIdentifier === ACTION_RECORD) return 'record';
  if (actionIdentifier === ACTION_TRANSFER) return 'transfer';
  if (actionIdentifier === ACTION_DISMISS) return 'dismiss';
  return 'open';
}
