/**
 * 自動チェックインを始める・止める（OS の位置情報 API を呼ぶ部分）。
 *
 * - ふだんは OS のジオフェンスだけで「駅に近づいた」ことを省電力で見張る
 * - 近づいたときだけ、数分間細かく位置を取って判定する（tasks.ts）
 * - 位置情報が「使用中のみ」だとバックグラウンドで届かないので、自動チェックインは使えない
 */
import * as Location from 'expo-location';
import { LocationActivityType } from 'expo-location';
import { Linking, Platform } from 'react-native';

import { type MasterData, getMaster } from '../data/master';
import { ensureDb } from '../db/client';
import { getExcludedStations } from '../db/queries';
import { loadSettings, setState } from '../db/settings';
import type { Db } from '../db/types';
import { planGeofences } from './geofences';

export const GEOFENCE_TASK = 'ekilog-geofence';
export const LOCATION_TASK = 'ekilog-location';
export const NOTIFICATION_TASK = 'ekilog-notification';

export type AutoPermission =
  /** 「常に許可」がある */
  | 'always'
  /** 「使用中のみ」。自動チェックインは使えない */
  | 'when-in-use'
  /** 許可されていない */
  | 'denied'
  /** まだ聞いていない */
  | 'undetermined'
  /** この端末では使えない（Web など） */
  | 'unavailable';

export async function getAutoPermission(): Promise<AutoPermission> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.granted) return 'always';
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.granted) return 'when-in-use';
    return fg.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unavailable';
  }
}

/** 「常に許可」を求める。説明の画面を見せてから呼ぶこと。 */
export async function requestAutoPermission(): Promise<AutoPermission> {
  if (Platform.OS === 'web') return 'unavailable';
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return fg.canAskAgain ? 'undetermined' : 'denied';
  const bg = await Location.requestBackgroundPermissionsAsync();
  return bg.granted ? 'always' : 'when-in-use';
}

export function openSystemSettings(): void {
  Linking.openSettings().catch(() => {});
}

/** 現在地のまわりの駅をジオフェンスに登録し直す。 */
export async function refreshGeofences(db: Db, master: MasterData, at?: { lat: number; lng: number }): Promise<number> {
  let pos = at;
  if (!pos) {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 }).catch(() => null);
    const cur = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    pos = { lat: cur.coords.latitude, lng: cur.coords.longitude };
  }
  const regions = planGeofences({
    lat: pos.lat,
    lng: pos.lng,
    platform: Platform.OS,
    nearby: (lat, lng, count) => master.nearest(lat, lng, count),
    excluded: new Set(getExcludedStations(db)),
  });
  await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
  setState(db, 'auto.plannedAt', { t: Date.now(), lat: pos.lat, lng: pos.lng });
  return regions.length - 1;
}

/** 駅の近くで、細かく位置を取り始める。 */
export async function startPrecise(batterySaver: boolean): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false)) return;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: batterySaver ? Location.Accuracy.Balanced : Location.Accuracy.High,
    timeInterval: batterySaver ? 30000 : 10000,
    distanceInterval: batterySaver ? 30 : 5,
    activityType: LocationActivityType.OtherNavigation,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: false,
    foregroundService: {
      notificationTitle: 'エキログ',
      notificationBody: '駅の近くにいるか確かめています',
      notificationColor: '#18181B',
    },
  });
}

export async function stopPrecise(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
  }
}

export async function stopAuto(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK).catch(() => false)) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK).catch(() => {});
  }
  await stopPrecise();
}

/**
 * 設定と許可に合わせて、ジオフェンスを動かす・止める。アプリを開いたときと、設定を変えたときに呼ぶ。
 * 返り値は、自動チェックインが実際に動いているか。
 */
export async function syncAuto(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const db = await ensureDb();
  const settings = loadSettings(db);
  if (!settings.autoEnabled || (await getAutoPermission()) !== 'always') {
    await stopAuto();
    return false;
  }
  try {
    await refreshGeofences(db, getMaster(db));
    return true;
  } catch {
    return false;
  }
}
