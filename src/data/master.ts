/**
 * 駅マスタをメモリに展開したもの。近い駅の検索（kdbush）、駅名の検索、ナンバリングの取り出しに使う。
 * 達成率などの集計はここではなく、SQL（src/db/queries.ts）で数える。
 */
import { sql } from 'drizzle-orm';
import { around } from 'geokdbush';
import KDBush from 'kdbush';

import type { Db } from '../db/types';
import { distanceM } from '../geo/distance';
import { collapseRomaji, searchKey, toHiragana } from '../lib/kana';

export type StationInfo = {
  id: number;
  name: string;
  kana: string | null;
  romaji: string | null;
  lat: number;
  lng: number;
  prefCode: number;
  muniCode: string;
  underground: boolean;
};

export type LineInfo = {
  id: number;
  name: string;
  code: string | null;
  color: string | null;
  ink: string | null;
  isLoop: boolean;
  stationCount: number;
  sort: number;
  operatorId: number;
  operatorName: string;
  badgeStyle: string | null;
  badgeFont: string | null;
};

export type StationLine = { line: LineInfo; number: string | null; seq: number };

/** ナンバリングバッジ1つぶん。 */
export type BadgeInfo = {
  code: string;
  num: string;
  color: string;
  ink: string | null;
  kind: string | null;
  font: string | null;
};

export type NearbyStation = { station: StationInfo; distance: number };

export class MasterData {
  readonly stations: StationInfo[];
  readonly prefNames = new Map<number, string>();
  readonly lines = new Map<number, LineInfo>();
  private readonly byId = new Map<number, StationInfo>();
  private readonly linesOf = new Map<number, StationLine[]>();
  private readonly muniNames = new Map<string, string>();
  private readonly kd: KDBush;
  private keys: string[] | null = null;

  constructor(db: Db) {
    for (const p of db.all<{ code: number; name: string }>(sql`SELECT code, name FROM prefectures`)) {
      this.prefNames.set(p.code, p.name);
    }
    for (const m of db.all<{ code: string; name: string; city: string | null }>(
      sql`SELECT code, name, city FROM municipalities`,
    )) {
      this.muniNames.set(m.code, (m.city ?? '') + m.name);
    }
    for (const l of db.all<{
      id: number; name: string; code: string | null; color: string | null; ink: string | null;
      is_loop: number; station_count: number; sort: number; operator_id: number;
      operator_name: string; badge_style: string | null; badge_font: string | null;
    }>(sql`
      SELECT l.id, l.name, l.code, l.color, l.ink, l.is_loop, l.station_count, l.sort,
             l.operator_id, o.name AS operator_name, o.badge_style, o.badge_font
        FROM lines l JOIN operators o ON o.id = l.operator_id
    `)) {
      this.lines.set(l.id, {
        id: l.id, name: l.name, code: l.code, color: l.color, ink: l.ink,
        isLoop: l.is_loop === 1, stationCount: l.station_count, sort: l.sort,
        operatorId: l.operator_id, operatorName: l.operator_name,
        badgeStyle: l.badge_style, badgeFont: l.badge_font,
      });
    }
    this.stations = db
      .all<{
        id: number; name: string; kana: string | null; romaji: string | null; lat: number;
        lng: number; pref_code: number; muni_code: string; underground: number;
      }>(sql`SELECT id, name, kana, romaji, lat, lng, pref_code, muni_code, underground FROM stations ORDER BY id`)
      .map((s) => ({
        id: s.id, name: s.name, kana: s.kana, romaji: s.romaji, lat: s.lat, lng: s.lng,
        prefCode: s.pref_code, muniCode: s.muni_code, underground: s.underground === 1,
      }));
    this.kd = new KDBush(this.stations.length, 64, Float64Array);
    for (const s of this.stations) {
      this.byId.set(s.id, s);
      this.kd.add(s.lng, s.lat);
    }
    this.kd.finish();
    for (const r of db.all<{ station_id: number; line_id: number; number: string | null; seq: number }>(
      sql`SELECT station_id, line_id, number, seq FROM station_lines`,
    )) {
      const line = this.lines.get(r.line_id);
      if (!line) continue;
      if (!this.linesOf.has(r.station_id)) this.linesOf.set(r.station_id, []);
      this.linesOf.get(r.station_id)!.push({ line, number: r.number, seq: r.seq });
    }
    for (const list of this.linesOf.values()) list.sort((a, b) => a.line.sort - b.line.sort);
  }

  station(id: number): StationInfo | undefined {
    return this.byId.get(id);
  }

  stationLines(id: number): StationLine[] {
    return this.linesOf.get(id) ?? [];
  }

  prefName(code: number): string {
    return this.prefNames.get(code) ?? '';
  }

  muniName(code: string): string {
    return this.muniNames.get(code) ?? '';
  }

  /** 駅のナンバリング。同じ記号と番号が複数の路線にあるとき（立川の JC19 など）は1つにまとめる。 */
  badges(id: number): BadgeInfo[] {
    const seen = new Set<string>();
    const out: BadgeInfo[] = [];
    for (const sl of this.stationLines(id)) {
      if (!sl.line.code || !sl.number) continue;
      const key = `${sl.line.code}-${sl.number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(this.badge(sl.line, sl.number));
    }
    return out;
  }

  badge(line: LineInfo, num: string): BadgeInfo {
    return {
      code: line.code ?? '',
      num,
      color: line.color ?? '#6B6B70',
      ink: line.ink,
      kind: line.badgeStyle,
      font: line.badgeFont,
    };
  }

  /** 一覧の2行目に出す説明。1路線だけの駅は「只見線 · 福島県」、乗換駅は「東京都 · JR東日本・東京メトロ ほか」。 */
  describe(id: number): string {
    const s = this.byId.get(id);
    if (!s) return '';
    const lines = this.stationLines(id);
    const pref = this.prefName(s.prefCode);
    const operators = [...new Set(lines.map((l) => l.line.operatorName))];
    if (operators.length <= 1 && lines.length === 1) return `${lines[0].line.name} · ${pref}`;
    if (operators.length <= 1) return `${pref} · ${operators[0] ?? ''}`;
    return `${pref} · ${operators.slice(0, 2).join('・')}${operators.length > 2 ? ' ほか' : ''}`;
  }

  /** 近い順に駅を返す。 */
  nearest(lat: number, lng: number, count: number, maxKm = Infinity): NearbyStation[] {
    return around(this.kd, lng, lat, count, maxKm).map((i) => {
      const station = this.stations[i];
      return { station, distance: distanceM({ lat, lng }, station) };
    });
  }

  /** 駅名・ひらがな・ローマ字・路線名で探す。 */
  search(query: string, limit = 30): StationInfo[] {
    const q = query.trim();
    if (q === '') return [];
    const hira = toHiragana(q);
    const key = searchKey(q);
    if (!this.keys) this.keys = this.stations.map((s) => (s.romaji ? collapseRomaji(s.romaji) : ''));
    const scored: { s: StationInfo; score: number }[] = [];
    for (let i = 0; i < this.stations.length; i++) {
      const s = this.stations[i];
      let score = -1;
      if (s.name === q) score = 0;
      else if (s.kana === hira) score = 1;
      else if (s.name.startsWith(q)) score = 2;
      else if (s.kana?.startsWith(hira)) score = 3;
      else if (key && key.length >= 2 && this.keys[i].startsWith(key)) score = 4;
      else if (s.name.includes(q)) score = 5;
      else if (hira.length >= 2 && s.kana?.includes(hira)) score = 6;
      if (score >= 0) scored.push({ s, score });
    }
    scored.sort(
      (a, b) =>
        a.score - b.score ||
        this.stationLines(b.s.id).length - this.stationLines(a.s.id).length ||
        a.s.name.length - b.s.name.length ||
        a.s.id - b.s.id,
    );
    const out = scored.slice(0, limit).map((x) => x.s);
    if (out.length < limit && q.length >= 2) {
      // 路線名でも探す（「山手線」で山手線の駅が並ぶ）
      const seen = new Set(out.map((s) => s.id));
      const matched = [...this.lines.values()]
        .filter((l) => l.name.includes(q))
        .sort((a, b) => Number(b.name.startsWith(q)) - Number(a.name.startsWith(q)) || a.sort - b.sort);
      for (const line of matched) {
        const members: { s: StationInfo; seq: number }[] = [];
        for (const s of this.stations) {
          const sl = this.linesOf.get(s.id)?.find((x) => x.line.id === line.id);
          if (sl) members.push({ s, seq: sl.seq });
        }
        members.sort((a, b) => a.seq - b.seq);
        for (const m of members) {
          if (out.length >= limit) return out;
          if (!seen.has(m.s.id)) {
            seen.add(m.s.id);
            out.push(m.s);
          }
        }
      }
    }
    return out;
  }
}

let cached: { db: Db; data: MasterData } | null = null;

/** 駅マスタを読み込む。2回目からは同じものを返す。 */
export function getMaster(db: Db): MasterData {
  if (!cached || cached.db !== db) cached = { db, data: new MasterData(db) };
  return cached.data;
}
