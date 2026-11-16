/** 現在地を1回取る。位置情報がオフでも画面は使える（検索から記録できる）。 */
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

import type { LatLng } from './distance';

export type LocationState =
  | { status: 'loading'; coords: null }
  | { status: 'granted'; coords: LatLng }
  | { status: 'denied'; coords: null }
  | { status: 'unavailable'; coords: null };

export function useCurrentLocation(): LocationState & { retry: () => void } {
  const [state, setState] = useState<LocationState>({ status: 'loading', coords: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) {
          if (alive) setState({ status: 'denied', coords: null });
          return;
        }
        // まず直前の位置をすぐ出し、そのあと測り直す
        const last = await Location.getLastKnownPositionAsync().catch(() => null);
        if (alive && last) {
          setState({ status: 'granted', coords: { lat: last.coords.latitude, lng: last.coords.longitude } });
        }
        const now = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (alive) {
          setState({ status: 'granted', coords: { lat: now.coords.latitude, lng: now.coords.longitude } });
        }
      } catch {
        if (alive) setState((s) => (s.status === 'granted' ? s : { status: 'unavailable', coords: null }));
      }
    })();
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading', coords: null });
    setAttempt((n) => n + 1);
  }, []);
  return { ...state, retry };
}
