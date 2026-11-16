/** アプリを開いている間の、自動チェックインまわりの準備（ルートのレイアウトで1回呼ぶ）。 */
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { ensureDb } from '../db/client';
import { notifyDataChanged } from '../db/events';
import { actionOf, prepareNotifications } from './notify';
import { syncAuto } from './service';
import { pruneSessions, respondToCandidate } from './session';

async function handleResponse(res: Notifications.NotificationResponse): Promise<void> {
  const data = res.notification.request.content.data as { candidateId?: number; url?: string } | undefined;
  const action = actionOf(res.actionIdentifier);
  if (action === 'open') {
    if (data?.url) router.push(data.url as never);
    return;
  }
  if (typeof data?.candidateId !== 'number') return;
  const db = await ensureDb();
  respondToCandidate(db, data.candidateId, action);
  notifyDataChanged();
  await Notifications.dismissNotificationAsync(res.notification.request.identifier).catch(() => {});
}

export function useAutoCheckin(ready: boolean): void {
  useEffect(() => {
    if (!ready || Platform.OS === 'web') return;
    let alive = true;
    (async () => {
      await prepareNotifications();
      const db = await ensureDb();
      pruneSessions(db, Date.now());
      // アプリが閉じている間に押された通知のボタン（同じ候補を二度記録することはない）
      const last = await Notifications.getLastNotificationResponseAsync().catch(() => null);
      if (alive && last) {
        await handleResponse(last);
        await Notifications.clearLastNotificationResponseAsync().catch(() => {});
      }
      await syncAuto();
    })().catch((e) => console.warn('自動チェックインの準備に失敗しました', e));

    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      handleResponse(res).catch((e) => console.warn(e));
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncAuto().catch(() => {});
    });
    return () => {
      alive = false;
      sub.remove();
      appState.remove();
    };
  }, [ready]);
}
