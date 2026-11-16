/**
 * 駅マスタの検査。作り直すたびに走らせ、件数・重複・座標の範囲・市区町村コードの欠けを調べる。
 * 同じ検査を Jest（src/db/__tests__/master.test.ts）からも呼ぶ。
 */
import Database from 'better-sqlite3';

export type MasterReport = { info: string[]; errors: string[] };

export function validateMaster(dbFile: string): MasterReport {
  const db = new Database(dbFile, { readonly: true });
  const info: string[] = [];
  const errors: string[] = [];
  const one = <T>(sql: string, ...params: unknown[]) => db.prepare(sql).get(...params) as T;
  const all = <T>(sql: string, ...params: unknown[]) => db.prepare(sql).all(...params) as T[];
  const count = (sql: string, ...params: unknown[]) => one<{ n: number }>(sql, ...params).n;

  const stations = count('SELECT COUNT(*) n FROM stations');
  const lines = count('SELECT COUNT(*) n FROM lines');
  const operators = count('SELECT COUNT(*) n FROM operators');
  const munis = count('SELECT COUNT(*) n FROM municipalities');
  const munisWithStation = count('SELECT COUNT(*) n FROM municipalities WHERE has_station = 1');
  info.push(`駅 ${stations}、路線 ${lines}、事業者 ${operators}、市区町村 ${munis}（駅あり ${munisWithStation}）`);

  // 件数
  if (stations < 8500 || stations > 10000) errors.push(`駅の数が想定の範囲外です: ${stations}`);
  if (count('SELECT COUNT(*) n FROM prefectures') !== 47) errors.push('都道府県が47ではありません');

  // 重複
  const dupIds = count('SELECT COUNT(*) n FROM (SELECT id FROM stations GROUP BY id HAVING COUNT(*) > 1)');
  if (dupIds > 0) errors.push(`駅IDが重複しています: ${dupIds}件`);
  const dupNear = all<{ name: string; n: number }>(
    `SELECT a.name name, COUNT(*) n FROM stations a JOIN stations b
       ON a.name = b.name AND a.id < b.id
      AND ABS(a.lat - b.lat) < 0.0015 AND ABS(a.lng - b.lng) < 0.0015
     GROUP BY a.name`,
  );
  if (dupNear.length > 0) errors.push(`同じ場所に同名の駅があります: ${dupNear.map((d) => d.name).join('、')}`);
  const dupSeq = count(
    'SELECT COUNT(*) n FROM (SELECT 1 FROM station_lines GROUP BY line_id, station_id HAVING COUNT(*) > 1)',
  );
  if (dupSeq > 0) errors.push(`同じ路線に同じ駅が2回入っています: ${dupSeq}件`);

  // 座標の範囲（日本の範囲に収まっているか）
  const outOfRange = count(
    'SELECT COUNT(*) n FROM stations WHERE lat < 24 OR lat > 45.6 OR lng < 122.9 OR lng > 145.9',
  );
  if (outOfRange > 0) errors.push(`座標が日本の範囲外の駅があります: ${outOfRange}件`);

  // 市区町村コードの欠け
  const noMuni = count(
    `SELECT COUNT(*) n FROM stations s LEFT JOIN municipalities m ON m.code = s.muni_code
      WHERE m.code IS NULL OR m.pref_code != s.pref_code`,
  );
  if (noMuni > 0) errors.push(`市区町村が付いていない駅があります: ${noMuni}件`);

  // どの路線にも入っていない駅
  const orphans = all<{ name: string }>(
    `SELECT s.name name FROM stations s
      WHERE NOT EXISTS (SELECT 1 FROM station_lines sl WHERE sl.station_id = s.id)`,
  );
  if (orphans.length > 0) errors.push(`路線のない駅があります: ${orphans.map((o) => o.name).join('、')}`);

  // 路線の駅数
  const badCount = count(
    `SELECT COUNT(*) n FROM lines l
      WHERE l.station_count != (SELECT COUNT(*) FROM station_lines sl WHERE sl.line_id = l.id)`,
  );
  if (badCount > 0) errors.push(`station_count が合わない路線があります: ${badCount}件`);

  // 新宿が1駅にまとまっている
  const shinjuku = all<{ id: number }>("SELECT id FROM stations WHERE name = '新宿' AND pref_code = 13");
  if (shinjuku.length !== 1) {
    errors.push(`新宿が1駅にまとまっていません: ${shinjuku.length}駅`);
  } else {
    const numbers = count(
      'SELECT COUNT(*) n FROM station_lines WHERE station_id = ? AND number IS NOT NULL',
      shinjuku[0].id,
    );
    info.push(`新宿のナンバリング ${numbers}件`);
    if (numbers !== 10) errors.push(`新宿のナンバリングが10ではありません: ${numbers}`);
  }

  // 東京都の「駅のある区市町村」は50（23区・25市・瑞穂町・奥多摩町）
  const tokyo = one<{ muni_count: number }>('SELECT muni_count FROM prefectures WHERE code = 13');
  info.push(`東京都の駅のある区市町村 ${tokyo.muni_count}`);
  if (tokyo.muni_count !== 50) errors.push(`東京都の駅のある区市町村が50ではありません: ${tokyo.muni_count}`);

  // 山手線は30駅の環状
  const yamanote = one<{ station_count: number; is_loop: number } | undefined>(
    "SELECT station_count, is_loop FROM lines WHERE code = 'JY'",
  );
  if (!yamanote || yamanote.station_count !== 30 || yamanote.is_loop !== 1) {
    errors.push('山手線（JY）が30駅の環状になっていません');
  }

  const kana = count('SELECT COUNT(*) n FROM stations WHERE kana IS NOT NULL');
  info.push(`読みがなのある駅 ${kana}（${((kana / stations) * 100).toFixed(1)}%）`);
  const numbered = count('SELECT COUNT(DISTINCT station_id) n FROM station_lines WHERE number IS NOT NULL');
  info.push(`ナンバリングのある駅 ${numbered}`);

  db.close();
  return { info, errors };
}
