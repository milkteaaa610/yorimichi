/** かな・ローマ字を、検索で突き合わせるための共通の形にそろえる。 */

export function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

export function isKanaOnly(s: string): boolean {
  return /^[ぁ-ゖァ-ヺー・\s]+$/.test(s);
}

const DIGRAPHS: Record<string, string> = {
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo', しゃ: 'sha', しゅ: 'shu', しょ: 'sho',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho', にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo', みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo', ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo', びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo', てぃ: 'ti', でぃ: 'di', ふぁ: 'fa', ふぃ: 'fi',
  ふぇ: 'fe', ふぉ: 'fo', うぃ: 'wi', うぇ: 'we', しぇ: 'she', じぇ: 'je', ちぇ: 'che',
};

const KANA: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'i', ゑ: 'e', を: 'o', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゃ: 'ya', ゅ: 'yu', ょ: 'yo', ゔ: 'vu',
  ゕ: 'ka', ゖ: 'ke',
};

/** ひらがな・カタカナをヘボン式のローマ字にする（検索用。長音や撥音の表記ゆれは collapse で吸収する）。 */
export function kanaToRomaji(input: string): string {
  const s = toHiragana(input);
  let out = '';
  let double = false;
  for (let i = 0; i < s.length; i++) {
    const two = DIGRAPHS[s.slice(i, i + 2)];
    let r: string | undefined;
    if (two) {
      r = two;
      i++;
    } else if (s[i] === 'っ') {
      double = true;
      continue;
    } else {
      r = KANA[s[i]];
    }
    if (r === undefined) continue; // 長音記号・中黒・空白などは捨てる
    if (double) {
      out += r[0];
      double = false;
    }
    out += r;
  }
  return out;
}

/**
 * 表記ゆれをならした検索キー。
 * 「Shin-Ōsaka」「しんおおさか」はどちらも shinosaka、「Shimbashi」「しんばし」はどちらも shinbashi になる。
 */
export function collapseRomaji(romaji: string): string {
  return romaji
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/tch/g, 'cch')
    .replace(/m(?=[bpm])/g, 'n')
    .replace(/o[ou]/g, 'o')
    .replace(/uu/g, 'u');
}

/** 入力がかな・英字だけなら検索キーを返す。漢字まじりなら null。 */
export function searchKey(query: string): string | null {
  const q = query.trim();
  if (q === '') return null;
  if (isKanaOnly(q)) return collapseRomaji(kanaToRomaji(q));
  if (/^[A-Za-z\s'-]+$/.test(q)) return collapseRomaji(q);
  return null;
}
