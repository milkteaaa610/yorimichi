import { TextInput, View } from 'react-native';

import { Icon } from './Icon';
import { IconButton } from './controls';
import { JP_FONT, colors } from './theme';

/** 検索の入力欄。 */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  testID,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  testID?: string;
}) {
  return (
    <View
      style={{
        height: 48,
        paddingLeft: 14,
        paddingRight: value ? 2 : 14,
        borderRadius: 14,
        backgroundColor: colors.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}>
      <Icon name="search" size={18} color={colors.sub} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.sub}
        accessibilityLabel={placeholder}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="never"
        style={{
          flex: 1,
          minWidth: 0,
          height: 48,
          fontFamily: JP_FONT[400],
          fontSize: 15,
          color: colors.ink,
          // Web の既定の枠線を消す
          outlineStyle: 'none',
        } as object}
      />
      {value !== '' && <IconButton icon="close" label="入力を消す" size={18} onPress={() => onChangeText('')} />}
    </View>
  );
}
