import Svg, { Path, Rect } from "react-native-svg";

interface AnnouncementMarkerIconProps {
  size?: number;
}

// DIP-FP-191-mobile-adj-3: lucide-react-native's icons are single-color
// paths via one color prop, with no built-in multi-part coloring — this
// needs a genuinely custom SVG for the red handle / white horn look.
// Flagging honestly (per the DIP's own note): fine visual tuning may take a
// follow-up round once actually seen on a device, since this couldn't be
// visually previewed during implementation.
export function AnnouncementMarkerIcon({ size = 48 }: AnnouncementMarkerIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Handle/grip — red, behind the horn's mouthpiece end. */}
      <Rect x={1} y={11} width={3.5} height={9} rx={1.5} fill="#dc2626" />
      {/* Horn — white fill with a thin dark outline, widening from the
          mouthpiece (narrow, left) to the bell (wide, right). */}
      <Path
        d="M3 10 H9 L18 3 V21 L9 14 H3 Z"
        fill="#ffffff"
        stroke="#111111"
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
