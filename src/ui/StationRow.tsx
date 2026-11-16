/** 駅の一覧の1行。駅名・ナンバリング・説明と、右側の日付や距離。 */
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import type { BadgeInfo } from '../data/master';
import { BadgeRow } from './NumberingBadge';
import { Text } from './Text';
import { Tag } from './controls';
import { colors } from './theme';

export function StationRow({
  name,
  badges,
  sub,
  first,
  right,
  onPress,
  testID,
}: {
  name: string;
  badges: BadgeInfo[];
  sub?: string;
  /** 「はじめて」の印を付ける */
  first?: boolean;
  right?: ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.hairline,
      }}>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <Text size={17} weight={700} style={{ marginRight: 2 }}>
            {name}
          </Text>
          <BadgeRow badges={badges} />
          {first && <Tag label="はじめて" />}
        </View>
        {sub !== undefined && sub !== '' && (
          <Text size={12} color={colors.sub}>
            {sub}
          </Text>
        )}
      </View>
      {right}
    </Pressable>
  );
}

/** 一覧の右側に出す2段の文字（日付と種類など）。 */
export function RowMeta({ top, bottom }: { top: string; bottom?: string }) {
  return (
    <View style={{ alignItems: 'flex-end', gap: 5 }}>
      <Text size={12} weight={600} tabular>
        {top}
      </Text>
      {bottom !== undefined && (
        <Text size={11} color={colors.sub}>
          {bottom}
        </Text>
      )}
    </View>
  );
}
