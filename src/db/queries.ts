/**
 * 記録の読み書きと、達成状況の集計。
 *
 * 達成率は保存せず、visits（記録DB）と駅マスタ（ATTACH した stations.db）から、その都度SQLで数える。
 * 「訪れた駅」に通過を含めるかは設定（countPass）で決まる。
 */
import { type SQL, and, desc, eq, inArray, sql } from 'drizzle-orm';

import {
  type CandidateStatus,
  type Photo,
  type Visit,
  type VisitKind,
  type VisitSource,
  autoCandidates,
  excludedStations,
  photos,
  visits,
} from './schema';
import type { Db } from './types';

/** 達成に数える記録の条件。 */
function counted(countPass: boolean): SQL {
  return countPass ? sql`1 = 1` : sql`kind != 'pass'`;
}

/** 訪れた駅のID（重複なし）。 */
function visitedStations(countPass: boolean): SQL {
  return sql`(SELECT DISTINCT station_id FROM visits WHERE ${counted(countPass)})`;
}

// ───────── ホーム ─────────

export type Totals = {
  stations: number;
  prefectures: number;
  municipalities: number;
  linesVisited: number;
  linesCompleted: number;
  newThisYear: number;
};

export function getTotals(db: Db, countPass: boolean, year = new Date().getFullYear()): Totals {
  const vs = visitedStations(countPass);
  const row = db.get<{
    stations: number; prefectures: number; municipalities: number;
    lines_visited: number; lines_completed: number; new_this_year: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*) FROM ${vs}) AS stations,
      (SELECT COUNT(DISTINCT s.pref_code) FROM ${vs} vs JOIN stations s ON s.id = vs.station_id) AS prefectures,
      (SELECT COUNT(DISTINCT s.muni_code) FROM ${vs} vs JOIN stations s ON s.id = vs.station_id) AS municipalities,
      (SELECT COUNT(DISTINCT sl.line_id) FROM station_lines sl JOIN ${vs} vs ON vs.station_id = sl.station_id) AS lines_visited,
      (SELECT COUNT(*) FROM (
         SELECT sl.line_id FROM station_lines sl LEFT JOIN ${vs} vs ON vs.station_id = sl.station_id
          GROUP BY sl.line_id HAVING COUNT(vs.station_id) = COUNT(*)
      )) AS lines_completed,
      (SELECT COUNT(*) FROM (
         SELECT station_id FROM visits WHERE ${counted(countPass)}
          GROUP BY station_id
         HAVING SUM(visited_on IS NULL) = 0 AND MIN(visited_on) >= ${`${year}-01-01`} AND MIN(visited_on) <= ${`${year}-12-31`}
      )) AS new_this_year
  `);
  return {
    stations: row.stations,
    prefectures: row.prefectures,
    municipalities: row.municipalities,
    linesVisited: row.lines_visited,
    linesCompleted: row.lines_completed,
    newThisYear: row.new_this_year,
  };
}

export type VisitRow = Visit & {
  /** その駅でいちばん古い記録なら true（「はじめて」の印） */
  isFirst: boolean;
  /** 並べ替えと表示に使う日付。日付なしの記録は登録した日 */
  shownOn: string;
  photoCount: number;
};

const SHOWN_ON = sql`COALESCE(v.visited_on, strftime('%Y-%m-%d', v.created_at / 1000, 'unixepoch', 'localtime'))`;

function selectVisits(db: Db, where: SQL, limit: number, offset = 0): VisitRow[] {
  return db
    .all<{
      id: number; station_id: number; kind: VisitKind; visited_on: string | null;
      source: VisitSource; memo: string | null; created_at: number;
      is_first: number; shown_on: string; photo_count: number;
    }>(sql`
      SELECT v.id, v.station_id, v.kind, v.visited_on, v.source, v.memo, v.created_at,
             ${SHOWN_ON} AS shown_on,
             (SELECT COUNT(*) FROM photos p WHERE p.visit_id = v.id) AS photo_count,
             NOT EXISTS (
               SELECT 1 FROM visits o
                WHERE o.station_id = v.station_id
                  AND (COALESCE(o.visited_on, '') < COALESCE(v.visited_on, '')
                       OR (COALESCE(o.visited_on, '') = COALESCE(v.visited_on, '') AND o.id < v.id))
             ) AS is_first
        FROM visits v
       WHERE ${where}
       ORDER BY shown_on DESC, v.created_at DESC, v.id DESC
       LIMIT ${limit} OFFSET ${offset}
    `)
    .map((r) => ({
      id: r.id,
      stationId: r.station_id,
      kind: r.kind,
      visitedOn: r.visited_on,
      source: r.source,
      memo: r.memo,
      createdAt: r.created_at,
      isFirst: r.is_first === 1,
      shownOn: r.shown_on,
      photoCount: r.photo_count,
    }));
}

export function getRecentVisits(db: Db, limit: number, offset = 0): VisitRow[] {
  return selectVisits(db, sql`1 = 1`, limit, offset);
}

export function getVisitCount(db: Db): number {
  return db.get<{ n: number }>(sql`SELECT COUNT(*) AS n FROM visits`).n;
}

// ───────── 駅の詳細 ─────────

export type StationSummary = {
  count: number;
  /** 日付のある記録のうち最初と最後（YYYY-MM-DD） */
  first: string | null;
  last: string | null;
  /** 日付なしの記録がある */
  hasUndated: boolean;
};

export function getStationSummary(db: Db, stationId: number): StationSummary {
  const r = db.get<{ n: number; first: string | null; last: string | null; undated: number | null }>(sql`
    SELECT COUNT(*) AS n, MIN(visited_on) AS first, MAX(visited_on) AS last,
           SUM(visited_on IS NULL) AS undated
      FROM visits WHERE station_id = ${stationId}
  `);
  return { count: r.n, first: r.first, last: r.last, hasUndated: (r.undated ?? 0) > 0 };
}

export function getStationVisits(db: Db, stationId: number, limit = 1000): VisitRow[] {
  return selectVisits(db, sql`v.station_id = ${stationId}`, limit);
}

export type PhotoRow = Photo & { visitedOn: string | null };

export function getStationPhotos(db: Db, stationId: number, limit = 1000): PhotoRow[] {
  return db
    .select({
      id: photos.id, visitId: photos.visitId, assetId: photos.assetId, uri: photos.uri,
      takenAt: photos.takenAt, lat: photos.lat, lng: photos.lng, visitedOn: visits.visitedOn,
    })
    .from(photos)
    .innerJoin(visits, eq(visits.id, photos.visitId))
    .where(eq(visits.stationId, stationId))
    .orderBy(desc(photos.takenAt), desc(photos.id))
    .limit(limit)
    .all();
}

/** 駅ごとの訪問回数（一覧の「訪問済み 2回」用）。 */
export function getVisitCounts(db: Db, stationIds: number[]): Map<number, number> {
  const out = new Map<number, number>();
  if (stationIds.length === 0) return out;
  const rows = db
    .select({ stationId: visits.stationId, n: sql<number>`COUNT(*)` })
    .from(visits)
    .where(inArray(visits.stationId, stationIds))
    .groupBy(visits.stationId)
    .all();
  for (const r of rows) out.set(r.stationId, r.n);
  return out;
}

// ───────── 都道府県・市区町村 ─────────

export type PrefStat = {
  code: number;
  name: string;
  /** 訪れた駅の数 */
  visited: number;
  stationCount: number;
  /** 訪れた市区町村の数 */
  muniVisited: number;
  /** 駅のある市区町村の数（分母） */
  muniCount: number;
};

export function getPrefStats(db: Db, countPass: boolean): PrefStat[] {
  return db
    .all<{
      code: number; name: string; visited: number; station_count: number;
      muni_visited: number; muni_count: number;
    }>(sql`
      SELECT p.code, p.name, p.station_count, p.muni_count,
             COUNT(vs.station_id) AS visited,
             COUNT(DISTINCT CASE WHEN vs.station_id IS NOT NULL THEN s.muni_code END) AS muni_visited
        FROM prefectures p
        LEFT JOIN stations s ON s.pref_code = p.code
        LEFT JOIN ${visitedStations(countPass)} vs ON vs.station_id = s.id
       GROUP BY p.code
       ORDER BY p.code
    `)
    .map((r) => ({
      code: r.code, name: r.name, visited: r.visited, stationCount: r.station_count,
      muniVisited: r.muni_visited, muniCount: r.muni_count,
    }));
}

export type MuniStat = {
  code: string;
  name: string;
  city: string | null;
  kind: 'special-ward' | 'ward' | 'city' | 'town' | 'village';
  hasStation: boolean;
  stationCount: number;
  visited: number;
};

export function getMuniStats(db: Db, prefCode: number, countPass: boolean): MuniStat[] {
  return db
    .all<{
      code: string; name: string; city: string | null; kind: MuniStat['kind'];
      has_station: number; station_count: number; visited: number;
    }>(sql`
      SELECT m.code, m.name, m.city, m.kind, m.has_station, m.station_count,
             COUNT(vs.station_id) AS visited
        FROM municipalities m
        LEFT JOIN stations s ON s.muni_code = m.code
        LEFT JOIN ${visitedStations(countPass)} vs ON vs.station_id = s.id
       WHERE m.pref_code = ${prefCode}
       GROUP BY m.code
       ORDER BY m.code
    `)
    .map((r) => ({
      code: r.code, name: r.name, city: r.city, kind: r.kind,
      hasStation: r.has_station === 1, stationCount: r.station_count, visited: r.visited,
    }));
}

// ───────── 路線 ─────────

export type LineStat = { lineId: number; visited: number; total: number };

/** 路線ごとの訪れた駅数。全駅を訪れたら「制覇」。 */
export function getLineStats(db: Db, countPass: boolean): Map<number, LineStat> {
  const rows = db.all<{ line_id: number; visited: number; total: number }>(sql`
    SELECT sl.line_id, COUNT(vs.station_id) AS visited, COUNT(*) AS total
      FROM station_lines sl
      LEFT JOIN ${visitedStations(countPass)} vs ON vs.station_id = sl.station_id
     GROUP BY sl.line_id
  `);
  return new Map(rows.map((r) => [r.line_id, { lineId: r.line_id, visited: r.visited, total: r.total }]));
}

export type LineStation = {
  stationId: number;
  name: string;
  number: string | null;
  seq: number;
  seg: number;
  visited: boolean;
};

export function getLineStations(db: Db, lineId: number, countPass: boolean): LineStation[] {
  return db
    .all<{
      station_id: number; name: string; number: string | null; seq: number; seg: number; visited: number;
    }>(sql`
      SELECT sl.station_id, s.name, sl.number, sl.seq, sl.seg,
             vs.station_id IS NOT NULL AS visited
        FROM station_lines sl
        JOIN stations s ON s.id = sl.station_id
        LEFT JOIN ${visitedStations(countPass)} vs ON vs.station_id = sl.station_id
       WHERE sl.line_id = ${lineId}
       ORDER BY sl.seq
    `)
    .map((r) => ({
      stationId: r.station_id, name: r.name, number: r.number, seq: r.seq, seg: r.seg,
      visited: r.visited === 1,
    }));
}

// ───────── 記録を書く ─────────

export type NewPhoto = {
  assetId?: string | null;
  uri?: string | null;
  takenAt?: number | null;
  lat?: number | null;
  lng?: number | null;
};

export const MAX_PHOTOS_PER_VISIT = 10;

export function addVisit(
  db: Db,
  input: {
    stationId: number;
    kind: VisitKind;
    visitedOn: string | null;
    source: VisitSource;
    memo?: string | null;
    photos?: NewPhoto[];
    createdAt?: number;
  },
): number {
  return db.transaction((tx) => {
    const row = tx
      .insert(visits)
      .values({
        stationId: input.stationId,
        kind: input.kind,
        visitedOn: input.visitedOn,
        source: input.source,
        memo: input.memo?.trim() ? input.memo.trim() : null,
        createdAt: input.createdAt ?? Date.now(),
      })
      .returning({ id: visits.id })
      .get();
    const list = (input.photos ?? []).slice(0, MAX_PHOTOS_PER_VISIT);
    if (list.length > 0) {
      tx.insert(photos).values(list.map((p) => photoValues(row.id, p))).run();
    }
    return row.id;
  });
}

function photoValues(visitId: number, p: NewPhoto) {
  return {
    visitId,
    assetId: p.assetId ?? null,
    uri: p.uri ?? null,
    takenAt: p.takenAt ?? null,
    lat: p.lat ?? null,
    lng: p.lng ?? null,
  };
}

/** 路線からまとめて登録。日付なしでも登録できる。 */
export function addVisitsBulk(
  db: Db,
  stationIds: number[],
  input: { kind?: VisitKind; visitedOn?: string | null; source?: VisitSource } = {},
): number {
  if (stationIds.length === 0) return 0;
  const now = Date.now();
  db.insert(visits)
    .values(
      stationIds.map((stationId) => ({
        stationId,
        kind: input.kind ?? ('got_off' as const),
        visitedOn: input.visitedOn ?? null,
        source: input.source ?? ('bulk' as const),
        memo: null,
        createdAt: now,
      })),
    )
    .run();
  return stationIds.length;
}

/** 記録済みの訪問に写真を足す。1件あたり10枚まで。足せた枚数を返す。 */
export function addPhotosToVisit(db: Db, visitId: number, list: NewPhoto[]): number {
  const current = db.get<{ n: number }>(sql`SELECT COUNT(*) AS n FROM photos WHERE visit_id = ${visitId}`).n;
  const existing = new Set(
    db.select({ assetId: photos.assetId }).from(photos).where(eq(photos.visitId, visitId)).all()
      .map((p) => p.assetId)
      .filter((a): a is string => a !== null),
  );
  const fresh = list
    .filter((p) => !p.assetId || !existing.has(p.assetId))
    .slice(0, Math.max(0, MAX_PHOTOS_PER_VISIT - current));
  if (fresh.length > 0) db.insert(photos).values(fresh.map((p) => photoValues(visitId, p))).run();
  return fresh.length;
}

export function updateVisit(
  db: Db,
  id: number,
  patch: { kind?: VisitKind; visitedOn?: string | null; memo?: string | null },
): void {
  db.update(visits).set(patch).where(eq(visits.id, id)).run();
}

export function deleteVisit(db: Db, id: number): void {
  db.delete(visits).where(eq(visits.id, id)).run();
}

/** ある駅の、ある日の記録（写真から記録で「記録済みなら写真だけ追加」に使う）。 */
export function findVisitOn(db: Db, stationId: number, visitedOn: string): Visit | undefined {
  return db
    .select()
    .from(visits)
    .where(and(eq(visits.stationId, stationId), eq(visits.visitedOn, visitedOn)))
    .orderBy(visits.id)
    .get();
}

export function hasVisited(db: Db, stationId: number): boolean {
  return db.get<{ n: number }>(sql`SELECT COUNT(*) AS n FROM visits WHERE station_id = ${stationId}`).n > 0;
}

// ───────── 自動チェックインの候補 ─────────

export type CandidateRow = {
  id: number;
  stationId: number;
  detectedAt: number;
  kindGuess: VisitKind;
  dwellSec: number;
  status: CandidateStatus;
};

export function addCandidate(
  db: Db,
  input: { stationId: number; detectedAt: number; kindGuess: VisitKind; dwellSec: number },
): number {
  return db
    .insert(autoCandidates)
    .values({ ...input, status: 'pending' })
    .returning({ id: autoCandidates.id })
    .get().id;
}

export function getPendingCandidates(db: Db): CandidateRow[] {
  return db
    .select({
      id: autoCandidates.id, stationId: autoCandidates.stationId, detectedAt: autoCandidates.detectedAt,
      kindGuess: autoCandidates.kindGuess, dwellSec: autoCandidates.dwellSec, status: autoCandidates.status,
    })
    .from(autoCandidates)
    .where(eq(autoCandidates.status, 'pending'))
    .orderBy(autoCandidates.detectedAt, autoCandidates.id)
    .all();
}

export function getCandidate(db: Db, id: number): CandidateRow | undefined {
  return db
    .select({
      id: autoCandidates.id, stationId: autoCandidates.stationId, detectedAt: autoCandidates.detectedAt,
      kindGuess: autoCandidates.kindGuess, dwellSec: autoCandidates.dwellSec, status: autoCandidates.status,
    })
    .from(autoCandidates)
    .where(eq(autoCandidates.id, id))
    .get();
}

/** 同じ駅をこの時刻より後に検知していれば、その時刻を返す（30分以内の再検知を防ぐ）。 */
export function lastDetectedAt(db: Db, stationId: number): number | null {
  const r = db.get<{ t: number | null }>(sql`
    SELECT MAX(detected_at) AS t FROM auto_candidates WHERE station_id = ${stationId}
  `);
  return r.t;
}

/** 候補を記録にする。すでに確認済みなら何もしない（通知とアプリの両方から呼ばれても二重にならない）。 */
export function recordCandidate(db: Db, id: number, kind?: VisitKind): number | null {
  return db.transaction((tx) => {
    const c = tx.select().from(autoCandidates).where(eq(autoCandidates.id, id)).get();
    if (!c || c.status !== 'pending') return null;
    const d = new Date(c.detectedAt);
    const visitedOn = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const visit = tx
      .insert(visits)
      .values({
        stationId: c.stationId,
        kind: kind ?? c.kindGuess,
        visitedOn,
        source: 'auto',
        memo: null,
        createdAt: c.detectedAt,
      })
      .returning({ id: visits.id })
      .get();
    tx.update(autoCandidates).set({ status: 'recorded', visitId: visit.id }).where(eq(autoCandidates.id, id)).run();
    return visit.id;
  });
}

export function dismissCandidate(db: Db, id: number): void {
  db.update(autoCandidates)
    .set({ status: 'dismissed' })
    .where(and(eq(autoCandidates.id, id), eq(autoCandidates.status, 'pending')))
    .run();
}

// ───────── 除外する駅 ─────────

export function getExcludedStations(db: Db): number[] {
  return db.select().from(excludedStations).all().map((r) => r.stationId);
}

export function setExcluded(db: Db, stationId: number, excluded: boolean): void {
  if (excluded) db.insert(excludedStations).values({ stationId }).onConflictDoNothing().run();
  else db.delete(excludedStations).where(eq(excludedStations.stationId, stationId)).run();
}
