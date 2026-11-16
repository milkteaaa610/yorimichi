/** 線のアイコン。形はデザインキャンバスのもの。 */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from './theme';

export type IconName =
  | 'search' | 'chevron-right' | 'chevron-left' | 'chevron-down' | 'close' | 'plus' | 'check'
  | 'home' | 'map' | 'route' | 'user' | 'more' | 'pin' | 'calendar' | 'camera' | 'photo'
  | 'signal' | 'sliders' | 'loop' | 'trash' | 'info';

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

export function Icon({ name, size = 22, color = colors.ink, strokeWidth = 1.8 }: Props) {
  const stroke = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'search' && (
        <>
          <Circle cx={11} cy={11} r={7} {...stroke} />
          <Path d="m20 20-3.5-3.5" {...stroke} />
        </>
      )}
      {name === 'chevron-right' && <Path d="m9 18 6-6-6-6" {...stroke} />}
      {name === 'chevron-left' && <Path d="m15 18-6-6 6-6" {...stroke} />}
      {name === 'chevron-down' && <Path d="m7 10 5 5 5-5" {...stroke} />}
      {name === 'close' && <Path d="M6 6l12 12M18 6 6 18" {...stroke} />}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...stroke} />}
      {name === 'check' && <Path d="m5 12.5 4.5 4.5L19 7.5" {...stroke} />}
      {name === 'home' && (
        <Path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" {...stroke} />
      )}
      {name === 'map' && (
        <>
          <Path d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2z" {...stroke} />
          <Path d="M9 4.5v13M15 6.5v13" {...stroke} />
        </>
      )}
      {name === 'route' && (
        <>
          <Circle cx={6} cy={5.5} r={2.2} {...stroke} />
          <Circle cx={18} cy={18.5} r={2.2} {...stroke} />
          <Path d="M8.2 5.5H15a3.5 3.5 0 0 1 0 7H9a3.5 3.5 0 0 0 0 7h6.8" {...stroke} />
        </>
      )}
      {name === 'user' && (
        <>
          <Circle cx={12} cy={8} r={3.8} {...stroke} />
          <Path d="M4.5 20c1.4-3.6 4.2-5.5 7.5-5.5s6.1 1.9 7.5 5.5" {...stroke} />
        </>
      )}
      {name === 'more' && (
        <>
          <Circle cx={5.5} cy={12} r={1.6} fill={color} />
          <Circle cx={12} cy={12} r={1.6} fill={color} />
          <Circle cx={18.5} cy={12} r={1.6} fill={color} />
        </>
      )}
      {name === 'pin' && (
        <>
          <Path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" {...stroke} />
          <Circle cx={12} cy={9.5} r={2.5} {...stroke} />
        </>
      )}
      {name === 'calendar' && (
        <>
          <Rect x={4} y={5} width={16} height={15} rx={2.5} {...stroke} />
          <Path d="M4 10h16M9 3v4M15 3v4" {...stroke} />
        </>
      )}
      {name === 'camera' && (
        <>
          <Path d="M4 8.5h3l1.8-2.5h6.4L17 8.5h3V19H4z" {...stroke} />
          <Circle cx={12} cy={13.5} r={3.2} {...stroke} />
        </>
      )}
      {name === 'photo' && (
        <>
          <Rect x={3.5} y={4.5} width={17} height={15} rx={2.5} {...stroke} />
          <Circle cx={9} cy={10} r={1.8} {...stroke} />
          <Path d="m20.5 15.5-4.5-4.5-8.5 8.5" {...stroke} />
        </>
      )}
      {name === 'signal' && (
        <>
          <Circle cx={12} cy={12} r={2.2} {...stroke} />
          <Path
            d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.4 5.4a9.3 9.3 0 0 0 0 13.2M18.6 5.4a9.3 9.3 0 0 1 0 13.2"
            {...stroke}
          />
        </>
      )}
      {name === 'sliders' && (
        <>
          <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" {...stroke} />
          <Circle cx={15} cy={7} r={2} {...stroke} />
          <Circle cx={9} cy={17} r={2} {...stroke} />
        </>
      )}
      {name === 'loop' && (
        <>
          <Path d="M20 12a8 8 0 1 1-2.3-5.6" {...stroke} />
          <Path d="M20 4v4.5h-4.5" {...stroke} />
        </>
      )}
      {name === 'trash' && (
        <Path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7M10 11v5M14 11v5" {...stroke} />
      )}
      {name === 'info' && (
        <>
          <Circle cx={12} cy={12} r={8.5} {...stroke} />
          <Path d="M12 11v5.5M12 7.8v.2" {...stroke} />
        </>
      )}
    </Svg>
  );
}
