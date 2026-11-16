/**
 * バックグラウンドのタスク。アプリを閉じていても OS から呼ばれる。
 * index.ts の先頭で読み込み、画面より先に定義しておく（expo-task-manager の決まり）。
 */
import * as Location from 'expo-location';
import { LocationGeofencingEventType } from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { getMaster } from '../data/master';
import { ensureDb } from '../db/client';
import { notifyDataChanged } from '../db/events';
import { loadSettings } from '../db/settings';
import type { Sample } from './detector';
import { parseRegionId } from './geofences';
import { actionOf, notifyCandidates } from './notify';
import { GEOFENCE_TASK, LOCATION_TASK, NOTIFICATION_TASK, refreshGeofences, startPrecise, stopPrecise } from './service';
import { addSamples, respondToCandidate, startSession } from './session';

type GeofenceData = { eventType: LocationGeofencingEventType; region: Location.LocationRegion };
type LocationData = { locations: Location.LocationObject[] };

function toSample(l: Location.LocationObject): Sample {
  return {
    t: l.timestamp,
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    speed: l.coords.speed,
    accuracy: l.coords.accuracy,
  };
}

/** ジオフェンス：駅に近づいた／外枠を抜けた。 */
async function onGeofence({ eventType, region }: GeofenceData): Promise<void> {
  const db = await ensureDb();
  const settings = loadSettings(db);
  if (!settings.autoEnabled) return;
  const target = parseRegionId(region.identifier);
  const master = getMaster(db);
  if (target === 'outer') {
    if (eventType === LocationGeofencingEventType.Exit) await refreshGeofences(db, master);
    return;
  }
  if (target === null || eventType !== LocationGeofencingEventType.Enter) return;
  // 直前の位置があれば、来た向きの手がかりとして入れておく
  const last = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000 }).catch(() => null);
  startSession(db, target, Date.now(), last ? [toSample(last)] : []);
  await startPrecise(settings.batterySaver);
}

/** 細かい位置：判定して、決まったら候補にする。 */
async function onLocations({ locations }: LocationData): Promise<void> {
  const db = await ensureDb();
  const master = getMaster(db);
  const { detected, active } = addSamples(db, master, locations.map(toSample), Date.now());
  if (detected.length > 0) {
    notifyDataChanged();
    await notifyCandidates(db, master, detected);
  }
  if (active === 0) await stopPrecise();
}

/** 通知のボタン（Android でアプリを閉じているとき）。 */
async function onNotificationResponse(data: unknown): Promise<void> {
  const res = data as { actionIdentifier?: string; notification?: { request?: { content?: { data?: { candidateId?: number } } } } };
  const id = res.notification?.request?.content?.data?.candidateId;
  const action = actionOf(res.actionIdentifier ?? '');
  if (typeof id !== 'number' || action === 'open') return;
  const db = await ensureDb();
  respondToCandidate(db, id, action);
  notifyDataChanged();
}

if (Platform.OS !== 'web') {
  TaskManager.defineTask<GeofenceData>(GEOFENCE_TASK, async ({ data, error }) => {
    if (error || !data) return;
    try {
      await onGeofence(data);
    } catch (e) {
      console.warn('ジオフェンスの処理に失敗しました', e);
    }
  });

  TaskManager.defineTask<LocationData>(LOCATION_TASK, async ({ data, error }) => {
    if (error || !data) return;
    try {
      await onLocations(data);
    } catch (e) {
      console.warn('位置の処理に失敗しました', e);
    }
  });

  TaskManager.defineTask(NOTIFICATION_TASK, async ({ data, error }) => {
    if (error || !data || typeof data !== 'object' || !('actionIdentifier' in data)) return;
    try {
      await onNotificationResponse(data);
    } catch (e) {
      console.warn('通知の処理に失敗しました', e);
    }
  });

  Notifications.registerTaskAsync(NOTIFICATION_TASK).catch(() => {});
}

export { onNotificationResponse };
