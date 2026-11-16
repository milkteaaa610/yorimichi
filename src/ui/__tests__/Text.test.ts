import { splitRuns } from '../Text';

test('英数字と日本語を書体ごとに分ける', () => {
  expect(splitRuns('412駅')).toEqual([
    { text: '412', latin: true },
    { text: '駅', latin: false },
  ]);
  expect(splitRuns('JR東日本 · 30駅')).toEqual([
    { text: 'JR', latin: true },
    { text: '東日本 · ', latin: false },
    { text: '30', latin: true },
    { text: '駅', latin: false },
  ]);
});
