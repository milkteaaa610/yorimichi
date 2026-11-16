/**
 * 路線の線路形状から「駅のつながり」を求め、駅の並び順を決める。
 *
 * N02 では駅が線路の1区間として入っているので、線路の頂点をノード、区間をエッジにした
 * グラフを作り、駅から駅まで線路をたどって隣どうしの駅を見つける。
 */
import { type Coord, type N02Section, type N02StationFeature, haversine } from './n02';

export type StationGraph = {
  /** 駅（グループコード）の一覧 */
  nodes: string[];
  /** 隣の駅と、そこまでの線路の距離（m） */
  adj: Map<string, Map<string, number>>;
};

function nodeId(c: Coord): string {
  return `${c[0].toFixed(5)},${c[1].toFixed(5)}`;
}

export function buildStationGraph(
  sections: N02Section[],
  stations: N02StationFeature[],
): StationGraph {
  const track = new Map<string, { to: string; len: number }[]>();
  const link = (a: Coord, b: Coord) => {
    const ia = nodeId(a);
    const ib = nodeId(b);
    if (ia === ib) return;
    const len = haversine(a, b);
    if (!track.has(ia)) track.set(ia, []);
    if (!track.has(ib)) track.set(ib, []);
    track.get(ia)!.push({ to: ib, len });
    track.get(ib)!.push({ to: ia, len });
  };
  for (const s of sections) {
    for (let i = 1; i < s.coords.length; i++) link(s.coords[i - 1], s.coords[i]);
  }
  // 駅の区間も線路としてつなぐ（線路側に同じ区間があれば重複するだけ）
  for (const s of stations) {
    for (let i = 1; i < s.coords.length; i++) link(s.coords[i - 1], s.coords[i]);
  }

  const stationAt = new Map<string, Set<string>>();
  const nodesOf = new Map<string, Set<string>>();
  for (const s of stations) {
    if (!nodesOf.has(s.group)) nodesOf.set(s.group, new Set());
    for (const c of s.coords) {
      const id = nodeId(c);
      nodesOf.get(s.group)!.add(id);
      if (!stationAt.has(id)) stationAt.set(id, new Set());
      stationAt.get(id)!.add(s.group);
    }
  }

  const adj = new Map<string, Map<string, number>>();
  const nodes = [...nodesOf.keys()];
  for (const g of nodes) adj.set(g, new Map());

  const connect = (a: string, b: string, d: number) => {
    const cur = adj.get(a)!.get(b);
    if (cur === undefined || d < cur) {
      adj.get(a)!.set(b, d);
      adj.get(b)!.set(a, d);
    }
  };

  for (const g of nodes) {
    // ダイクストラ法。別の駅に着いたらそこで止める。
    const dist = new Map<string, number>();
    const queue: { id: string; d: number }[] = [];
    for (const id of nodesOf.get(g)!) {
      dist.set(id, 0);
      queue.push({ id, d: 0 });
      for (const other of stationAt.get(id)!) if (other !== g) connect(g, other, 0);
    }
    while (queue.length > 0) {
      let best = 0;
      for (let i = 1; i < queue.length; i++) if (queue[i].d < queue[best].d) best = i;
      const cur = queue.splice(best, 1)[0];
      if (cur.d > (dist.get(cur.id) ?? Infinity)) continue;
      for (const e of track.get(cur.id) ?? []) {
        const nd = cur.d + e.len;
        if (nd >= (dist.get(e.to) ?? Infinity)) continue;
        dist.set(e.to, nd);
        const owners = stationAt.get(e.to);
        if (owners && !owners.has(g)) {
          for (const other of owners) connect(g, other, nd);
          continue; // 駅の先へは進まない
        }
        queue.push({ id: e.to, d: nd });
      }
    }
  }
  return { nodes, adj };
}

/** 駅グラフ上の最短経路。avoid に入っている駅は通らない。 */
export function shortestPath(
  g: StationGraph,
  from: string,
  to: string,
  avoid: Set<string> = new Set(),
): string[] | null {
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const done = new Set<string>();
  for (;;) {
    let cur: string | null = null;
    let best = Infinity;
    for (const [id, d] of dist) {
      if (!done.has(id) && d < best) {
        best = d;
        cur = id;
      }
    }
    if (cur === null) return null;
    if (cur === to) break;
    done.add(cur);
    for (const [nb, len] of g.adj.get(cur) ?? []) {
      if (done.has(nb) || (avoid.has(nb) && nb !== to)) continue;
      const nd = best + len;
      if (nd < (dist.get(nb) ?? Infinity)) {
        dist.set(nb, nd);
        prev.set(nb, cur);
      }
    }
  }
  const out = [to];
  let c = to;
  while (c !== from) {
    c = prev.get(c)!;
    out.push(c);
  }
  return out.reverse();
}

function distancesFrom(g: StationGraph, from: string, within: Set<string>): Map<string, number> {
  const dist = new Map<string, number>([[from, 0]]);
  const done = new Set<string>();
  for (;;) {
    let cur: string | null = null;
    let best = Infinity;
    for (const [id, d] of dist) {
      if (!done.has(id) && d < best) {
        best = d;
        cur = id;
      }
    }
    if (cur === null) break;
    done.add(cur);
    for (const [nb, len] of g.adj.get(cur) ?? []) {
      if (!within.has(nb) || done.has(nb)) continue;
      const nd = best + len;
      if (nd < (dist.get(nb) ?? Infinity)) dist.set(nb, nd);
    }
  }
  return dist;
}

export type Ordered = { id: string; seg: number };

export type OrderHints = {
  /** 大きいほど起点にふさわしい（乗り入れる路線の数など） */
  hubScore: (id: string) => number;
  /** 小さいほど起点にふさわしい（東京駅からの距離など） */
  tieBreak: (id: string) => number;
};

/**
 * 駅を路線図の順に並べる。いちばん長い道すじを本線とし、枝分かれは別の区間（seg）にする。
 */
export function orderStations(g: StationGraph, hints: OrderHints): Ordered[] {
  const seen = new Set<string>();
  const comps: string[][] = [];
  for (const n of g.nodes) {
    if (seen.has(n)) continue;
    const comp: string[] = [];
    const stack = [n];
    seen.add(n);
    while (stack.length > 0) {
      const c = stack.pop()!;
      comp.push(c);
      for (const nb of g.adj.get(c)!.keys()) {
        if (!seen.has(nb)) {
          seen.add(nb);
          stack.push(nb);
        }
      }
    }
    comps.push(comp);
  }
  const better = (a: string, b: string) => {
    const ha = hints.hubScore(a);
    const hb = hints.hubScore(b);
    if (ha !== hb) return hb - ha;
    return hints.tieBreak(a) - hints.tieBreak(b);
  };
  comps.sort((a, b) => b.length - a.length || better([...a].sort(better)[0], [...b].sort(better)[0]));

  const out: Ordered[] = [];
  let seg = 0;
  for (const comp of comps) {
    const within = new Set(comp);
    const visited = new Set<string>();
    const emit = (ids: string[]) => {
      for (const id of ids) {
        visited.add(id);
        out.push({ id, seg });
      }
      seg++;
    };

    const leaves = comp.filter((n) => g.adj.get(n)!.size <= 1);
    let main: string[];
    if (comp.length === 1) {
      main = comp;
    } else if (leaves.length >= 2) {
      // 端どうしでいちばん遠い組を本線の両端にする
      let bestPair: [string, string] = [leaves[0], leaves[1]];
      let bestDist = -1;
      for (const a of leaves) {
        const d = distancesFrom(g, a, within);
        for (const b of leaves) {
          const v = d.get(b) ?? -1;
          if (v > bestDist) {
            bestDist = v;
            bestPair = [a, b];
          }
        }
      }
      const [a, b] = bestPair.sort(better);
      main = shortestPath(g, a, b)!;
    } else {
      // 環状、または端が1つだけ：端（なければ主要駅）から順にたどる
      const start = leaves[0] ?? [...comp].sort(better)[0];
      main = [start];
      const used = new Set(main);
      let cur = start;
      for (;;) {
        const next = [...g.adj.get(cur)!.entries()]
          .filter(([nb]) => !used.has(nb))
          .sort((x, y) => x[1] - y[1])[0];
        if (!next) break;
        cur = next[0];
        used.add(cur);
        main.push(cur);
      }
    }
    emit(main);

    // 枝分かれ：本線の順に、まだ出ていない駅を外へ向かってたどる
    const walkBranches = (trunk: string[]) => {
      for (const junction of trunk) {
        for (;;) {
          const next = [...g.adj.get(junction)!.entries()]
            .filter(([nb]) => !visited.has(nb))
            .sort((x, y) => x[1] - y[1])[0];
          if (!next) break;
          const branch = [next[0]];
          const used = new Set(branch);
          let cur = next[0];
          for (;;) {
            const step = [...g.adj.get(cur)!.entries()]
              .filter(([nb]) => !visited.has(nb) && !used.has(nb))
              .sort((x, y) => x[1] - y[1])[0];
            if (!step) break;
            cur = step[0];
            used.add(cur);
            branch.push(cur);
          }
          emit(branch);
          walkBranches(branch);
        }
      }
    };
    walkBranches(main);
  }
  return out;
}
