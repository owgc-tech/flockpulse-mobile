import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Pencil, TriangleAlert } from "lucide-react-native";
import {
  formatModifiedSummary,
  formatNeedsAttentionSummary,
  getModifiedA11yLabel,
  getNeedsAttentionA11yLabel,
} from "@/src/features/events/utils";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

// FP-222-mobile: the two unmistakable event indicators — a solid red
// "NEEDS ATTENTION" strip (owner and Admins only; the server decides) and a
// solid amber "RECENTLY MODIFIED" strip — each naming WHAT (refused tasks /
// changed fields). Needs Attention renders first; both can show together and
// stack with no gap.
//
// Never colour alone: every strip carries an icon AND bold uppercase text, and
// an accessibilityLabel that speaks the whole message. Text/icon colours are the
// onDanger / onWarning theme tokens, chosen for >= 4.5:1 contrast on the strip's
// own background in both themes (measured values are documented in colors.ts).
//
// variant "card": bleeds to the edges of EventListItem's card — the card
// container has padding 16 and overflow hidden, so the strips use -16 horizontal
// margins and a -16 top margin and the card's own rounded corners clip them.
// variant "detail": the same strips at the top of the detail screen's content
// with normal margins and rounded corners.
export const CARD_PADDING = 16;

interface EventIndicatorBannersProps {
  eventId: string;
  variant: "card" | "detail";
  // Every prop is optional on purpose: the JSON a screen gets through route
  // params or a notification payload can predate these fields entirely.
  needsAttention?: boolean;
  needsAttentionTasks?: string[];
  isModified?: boolean;
  modifiedFields?: string[];
}

function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    dangerStrip: { backgroundColor: colors.danger },
    warningStrip: { backgroundColor: colors.warning },
    dangerText: { color: colors.onDanger },
    warningText: { color: colors.onWarning },
  });
}

export function EventIndicatorBanners({
  eventId,
  variant,
  needsAttention = false,
  needsAttentionTasks = [],
  isModified = false,
  modifiedFields = [],
}: EventIndicatorBannersProps) {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);

  if (!needsAttention && !isModified) return null;

  const idPrefix = variant === "card" ? "event-item" : "event-detail";
  const needsAttentionLine = formatNeedsAttentionSummary(needsAttentionTasks);
  const modifiedLine = formatModifiedSummary(modifiedFields);

  return (
    <View style={variant === "card" ? styles.cardWrapper : styles.detailWrapper}>
      {needsAttention ? (
        <View
          style={[styles.strip, themed.dangerStrip]}
          accessible
          accessibilityRole="alert"
          accessibilityLabel={getNeedsAttentionA11yLabel(needsAttentionTasks)}
          testID={`${idPrefix}-needs-attention-${eventId}`}
        >
          <TriangleAlert size={18} color={colors.onDanger} />
          <View style={styles.textColumn}>
            <Text style={[styles.title, themed.dangerText]}>NEEDS ATTENTION</Text>
            {needsAttentionLine ? <Text style={[styles.line, themed.dangerText]}>{needsAttentionLine}</Text> : null}
          </View>
        </View>
      ) : null}
      {isModified ? (
        <View
          style={[styles.strip, themed.warningStrip]}
          accessible
          accessibilityRole="text"
          accessibilityLabel={getModifiedA11yLabel(modifiedFields)}
          testID={`${idPrefix}-modified-${eventId}`}
        >
          <Pencil size={18} color={colors.onWarning} />
          <View style={styles.textColumn}>
            <Text style={[styles.title, themed.warningText]}>RECENTLY MODIFIED</Text>
            {modifiedLine ? <Text style={[styles.line, themed.warningText]}>{modifiedLine}</Text> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Bleeds to the card's edges and sits above the normal card content, which
  // keeps its usual spacing below (marginBottom). The card's overflow: hidden
  // plus its borderRadius round the top corners of the first strip.
  cardWrapper: {
    marginTop: -CARD_PADDING,
    marginHorizontal: -CARD_PADDING,
    marginBottom: 12,
  },
  // Normal margins; the wrapper's own radius + overflow rounds the stack as one
  // block (stacked strips touch each other).
  detailWrapper: {
    marginBottom: 16,
    borderRadius: 8,
    overflow: "hidden",
  },
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: CARD_PADDING,
    paddingVertical: 10,
  },
  textColumn: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  line: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
});
