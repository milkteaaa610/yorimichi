import { collapseRomaji, kanaToRomaji, searchKey } from '../kana';

test('かなをヘボン式に', () => {
  expect(kanaToRomaji('しんじゅく')).toBe('shinjuku');
  expect(kanaToRomaji('きっしょうじ')).toBe('kisshouji');
  expect(kanaToRomaji('チャタン')).toBe('chatan');
});

test('表記ゆれをならす', () => {
  expect(collapseRomaji('Shin-Ōsaka')).toBe(collapseRomaji(kanaToRomaji('しんおおさか')));
  expect(collapseRomaji('Shimbashi')).toBe(collapseRomaji(kanaToRomaji('しんばし')));
  expect(searchKey('新宿')).toBeNull();
});
