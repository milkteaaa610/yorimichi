/**
 * 自前のCSV（data/numbering）から、ナンバリングつきの路線を組み立てる。
 *
 * lines.csv    … 路線ごとの記号・色と、もとにする N02 の路線
 * segments.csv … 駅の並びと番号。次の2通りで書ける
 *   path: 「起点>経由>終点」。N02 の線路をたどって駅を並べ、first から順に番号を振る
 *   list: 「駅A|駅B|駅C」。書いた順に並べる（快速のように途中の駅を飛ばす路線に使う）
 *   どちらも「駅名=12」で番号を指定、「駅名=」で番号なしにできる（番号は消費しない）
 */
import path from 'node:path';

import { readCsv } from './csv';
import { type StationGraph, buildStationGraph, shortestPath } from './graph';
import { type Coord, type N02Data, haversine } from './n02';

export type LineDef = {
  key: string;
  operator: string;
  operatorName: string | null;
  name: string;
  code: string;
  color: string;
  ink: string | null;
  loop: boolean;
  sources: string[];
  hides: string[];
  segs: SegDef[];
};

type SegDef = {
  mode: 'path' | 'list';
  first: number | null;
  last: number | null;
  spec: string;
  branch: boolean;
};

export type DefEntry = { group: string; number: string | null; seg: number };

export function normalizeName(name: string): string {
  return name.normalize('NFKC').replace(/ヶ/g, 'ケ').replace(/ヵ/g, 'カ').replace(/\s+/g, '');
}

export function loadLineDefs(dataDir: string): LineDef[] {
  const lines = readCsv(path.join(dataDir, 'numbering', 'lines.csv'));
  const segs = readCsv(path.join(dataDir, 'numbering', 'segments.csv'));
  const defs = lines.map<LineDef>((r) => {
    const sources = r.sources.split('|').filter(Boolean);
    return {
      key: r.key,
      operator: r.operator,
      operatorName: r.operator_name || null,
      name: r.name,
      code: r.code,
      color: r.color,
      ink: r.ink || null,
      loop: r.loop === '1',
      sources,
      hides: r.hides === '*' ? sources : r.hides.split('|').filter(Boolean),
      segs: [],
    };
  });
  const byKey = new Map(defs.map((d) => [d.key, d]));
  if (byKey.size !== defs.length) throw new Error('lines.csv: key が重複しています');
  for (const s of segs) {
    const def = byKey.get(s.line_key);
    if (!def) throw new Error(`segments.csv: lines.csv にない line_key です: ${s.line_key}`);
    if (s.mode !== 'path' && s.mode !== 'list') throw new Error(`segments.csv: mode が不正です: ${s.mode}`);
    def.segs.push({
      mode: s.mode,
      first: s.first === '' ? null : Number(s.first),
      last: s.last === '' ? null : Number(s.last),
      spec: s.spec,
      branch: s.branch === '1',
    });
  }
  for (const d of defs) {
    if (d.segs.length === 0) throw new Error(`segments.csv: ${d.key} の駅の並びがありません`);
  }
  return defs;
}

type Token = { name: string; explicit: boolean; number: string | null };

function parseToken(raw: string): Token {
  const i = raw.indexOf('=');
  if (i < 0) return { name: raw.trim(), explicit: false, number: null };
  const num = raw.slice(i + 1).trim();
  return { name: raw.slice(0, i).trim(), explicit: true, number: num === '' ? null : num };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export type ApplyContext = {
  data: N02Data;
  posOf: Map<string, Coord>;
  nameOf: Map<string, string>;
};

export function applyLineDef(def: LineDef, ctx: ApplyContext): DefEntry[] {
  const stations = ctx.data.stations.filter(
    (s) => s.op === def.operator && def.sources.includes(s.line),
  );
  if (stations.length === 0) {
    throw new Error(`${def.key}: N02 に「${def.operator} / ${def.sources.join('・')}」が見つかりません`);
  }
  const sections = ctx.data.sections.filter(
    (s) => s.op === def.operator && def.sources.includes(s.line),
  );
  const candidates = new Map<string, string[]>();
  for (const s of stations) {
    const k = normalizeName(s.name);
    if (!candidates.has(k)) candidates.set(k, []);
    if (!candidates.get(k)!.includes(s.group)) candidates.get(k)!.push(s.group);
  }
  let graph: StationGraph | null = null;
  const getGraph = () => (graph ??= buildStationGraph(sections, stations));

  const out: DefEntry[] = [];
  const index = new Map<string, DefEntry>();
  let seg = 0;
  let last: string | null = null;

  const resolve = (name: string): string => {
    const c = candidates.get(normalizeName(name));
    if (!c) {
      throw new Error(`${def.key}: 駅「${name}」が ${def.sources.join('・')} にありません`);
    }
    if (c.length === 1 || last === null) return c[0];
    const from = ctx.posOf.get(last)!;
    return [...c].sort(
      (a, b) => haversine(ctx.posOf.get(a)!, from) - haversine(ctx.posOf.get(b)!, from),
    )[0];
  };
  const add = (group: string, number: string | null) => {
    last = group;
    const existing = index.get(group);
    if (existing) {
      if (existing.number === null && number !== null) existing.number = number;
      return;
    }
    const entry = { group, number, seg };
    index.set(group, entry);
    out.push(entry);
  };

  for (const s of def.segs) {
    if (s.branch) seg++;
    const step = s.first !== null && s.last !== null && s.last < s.first ? -1 : 1;
    let counter = s.first;
    let lastAssigned: number | null = null;
    const take = (tokenOf: Token | undefined, group: string) => {
      if (tokenOf?.explicit) {
        add(group, tokenOf.number);
        return;
      }
      if (counter === null) {
        add(group, null);
        return;
      }
      add(group, pad(counter));
      lastAssigned = counter;
      counter += step;
    };

    if (s.mode === 'list') {
      for (const raw of s.spec.split('|')) {
        const t = parseToken(raw);
        take(t, resolve(t.name));
      }
    } else {
      const tokens = s.spec.split('>').map(parseToken);
      if (tokens.length < 2) throw new Error(`${def.key}: path は「起点>終点」で書きます: ${s.spec}`);
      const g = getGraph();
      const savedLast: string | null = last;
      const groups = tokens.map((t) => {
        const r = resolve(t.name);
        last = r;
        return r;
      });
      last = savedLast;
      const tokenAt = new Map(groups.map((gr, i) => [gr, tokens[i]]));
      const route: string[] = [groups[0]];
      const visited = new Set<string>(route);
      for (let i = 1; i < groups.length; i++) {
        const leg = shortestPath(g, groups[i - 1], groups[i], visited);
        if (!leg) {
          throw new Error(`${def.key}: ${tokens[i - 1].name} から ${tokens[i].name} へ線路がつながっていません`);
        }
        for (const id of leg.slice(1)) {
          route.push(id);
          visited.add(id);
        }
      }
      for (const id of route) take(tokenAt.get(id), id);
    }
    if (s.last !== null && lastAssigned !== s.last) {
      const names = out.map((e) => `${ctx.nameOf.get(e.group)}${e.number ?? ''}`).join(' ');
      throw new Error(
        `${def.key}: 最後の番号が ${s.last} のはずが ${lastAssigned} になりました（${s.spec}）\n  ${names}`,
      );
    }
  }
  return out;
}
