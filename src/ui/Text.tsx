/**
 * アプリの文字。英数字は Geologica、日本語は Noto Sans JP で描く。
 *
 * React Native は1つの Text に書体を1つしか指定できないので、文字列を
 * 「英数字のかたまり」と「それ以外」に分け、かたまりごとに書体を当てる。
 */
import { Children, type ReactNode } from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { JP_FONT, LATIN_FONT, type Weight, colors } from './theme';

export type TextProps = RNTextProps & {
  weight?: Weight;
  size?: number;
  color?: string;
  /** 数字の幅をそろえる */
  tabular?: boolean;
  /** 行の高さ（文字サイズに対する倍率） */
  leading?: number;
  /** 字間（em） */
  tracking?: number;
  center?: boolean;
};

type Run = { text: string; latin: boolean };

const isLatin = (ch: string) => /[0-9A-Za-zÀ-ɏ]/.test(ch);
const isNeutral = (ch: string) => /[ -/:-@[-`{-¿‐-‧←-↓]/.test(ch);

/** 文字列を書体ごとのかたまりに分ける。空白や記号は直前のかたまりに含める。 */
export function splitRuns(text: string): Run[] {
  const runs: Run[] = [];
  let pending = '';
  for (const ch of text) {
    if (isNeutral(ch)) {
      if (runs.length > 0) runs[runs.length - 1].text += ch;
      else pending += ch;
      continue;
    }
    const latin = isLatin(ch);
    const last = runs[runs.length - 1];
    if (last && last.latin === latin) {
      last.text += ch;
    } else {
      runs.push({ text: pending + ch, latin });
      pending = '';
    }
  }
  if (pending !== '') runs.push({ text: pending, latin: true });
  return runs;
}

export function Text({
  weight = 400,
  size,
  color,
  tabular,
  leading,
  tracking,
  center,
  style,
  children,
  ...rest
}: TextProps) {
  const base: TextStyle = {
    fontFamily: JP_FONT[weight],
    color: color ?? colors.ink,
    ...(size !== undefined && { fontSize: size }),
    ...(size !== undefined && leading !== undefined && { lineHeight: Math.round(size * leading) }),
    ...(size !== undefined && tracking !== undefined && { letterSpacing: size * tracking }),
    ...(tabular && { fontVariant: ['tabular-nums'] }),
    ...(center && { textAlign: 'center' }),
  };
  let key = 0;
  const content: ReactNode[] = Children.toArray(children).flatMap<ReactNode>((child) => {
    if (typeof child !== 'string' && typeof child !== 'number') return [child];
    return splitRuns(String(child)).map((run) =>
      run.latin ? (
        <RNText key={`latin-${key++}`} style={{ fontFamily: LATIN_FONT[weight] }}>
          {run.text}
        </RNText>
      ) : (
        run.text
      ),
    );
  });
  return (
    <RNText maxFontSizeMultiplier={1.3} {...rest} style={[base, style]}>
      {content}
    </RNText>
  );
}
