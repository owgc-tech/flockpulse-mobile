import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
// DIP-FP-179-mobile: @react-navigation/bottom-tabs is no longer a
// standalone installable package as of expo-router 57 — confirmed live,
// it's fully vendored internally (expo-router's own package.json lists no
// @react-navigation/* dependency or peerDependency at all anymore).
// expo-router re-exports the identical types/API from this build path
// (confirmed against its own .d.ts — BottomTabBarProps/
// BottomTabNavigationOptions are exported unchanged); no exports map
// restricts this deep import, and there is no shallower public alias for
// it. A real architectural change surfaced by this SDK bump, not a rename.
import type { BottomTabBarProps, BottomTabNavigationOptions } from "expo-router/build/react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { Calendar, ChartColumn, CircleCheck, ClipboardCheck, ListChecks } from "lucide-react-native";
import { useThemeColors } from "@/src/theme/useThemeColors";
import { darkColors } from "@/src/theme/colors";
import { setVisibleTabRouteNames } from "@/src/features/navigation/visibleTabRouteNamesStore";

// DIP-FP-155: JS-based approximation of Liquid Glass tabs — an oval
// container, SVG icons, and a translucent pill that slides behind the
// active tab, chosen specifically because it ships through the existing
// Expo Go / OTA workflow (verified live: expo-blur's SDK-54-compatible
// version has no native rebuild requirement, and lucide-react-native has no
// native code of its own — it draws through react-native-svg, already
// proven working in this project via MfaEnrollForm's QR code).
//
// "CheckCircle" from the DIP is CircleCheck here — the installed
// lucide-react-native version renamed it under lucide's noun-first
// convention; same icon, same intent.
const ROUTE_ICONS: Record<string, typeof Calendar> = {
  "dashboard/index": ChartColumn,
  index: Calendar,
  "confirmations/index": CircleCheck,
  "self-report/index": ClipboardCheck,
  // DIP-FP-161-5-my-tasks-tab: distinct from ClipboardCheck
  // (Self-Report)/CircleCheck (Confirmations) — a checklist reads as
  // "tasks" specifically rather than a generic completion mark.
  "my-tasks/index": ListChecks,
};

// DIP-FP-182-mobile: Dashboard has no label (icon-only tab) and its icon
// stays accent-colored regardless of focus, unlike every other tab here —
// it's meant to read as a persistent, always-visible shortcut rather than
// a normal destination that dims when you're not on it.
const ALWAYS_ACCENT_ROUTES = new Set(["dashboard/index"]);

// A fully custom tabBar takes over ALL rendering, so nothing from the
// default renderer carries over automatically — this is the one piece that
// isn't obvious from the default's visible behavior: `href: null` (used to
// hide Confirmations for Member-tier) does NOT remove the route from
// state.routes. Confirmed live against expo-router's TabsClient.js — it's
// expressed as tabBarItemStyle: { display: 'none' } (plus a tabBarButton
// override returning null), the same style hint the *default* tab bar reads
// to hide its button. A custom tabBar must check this itself or the hidden
// route renders anyway.
// DIP-FP-194-mobile: exported so useSwipeTabNavigation.ts can reuse this
// exact check rather than re-deriving "is this tab visible" logic —
// swiping toward Confirmations must be a no-op for Member-tier the same
// way tapping it already is (there's no tab button to tap in the first
// place), not a second, slightly-different implementation of this rule.
export function isRouteHidden(options: BottomTabNavigationOptions): boolean {
  const flatStyle = StyleSheet.flatten(options.tabBarItemStyle);
  return flatStyle?.display === "none";
}

interface TabLayout {
  x: number;
  width: number;
}

export function AnimatedTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const colors = useThemeColors();
  const isDark = colors === darkColors;

  const visibleRoutes = state.routes
    .map((route, index) => ({ route, index }))
    .filter(({ route }) => !isRouteHidden(descriptors[route.key].options));

  // DIP-FP-194-mobile: this is the one place that legitimately has
  // descriptors (only ever handed to the tabBar render prop) — publishes
  // the already-computed visible-route-name list so
  // useSwipeTabNavigation.ts (called from inside a tab screen, which has
  // no access to descriptors/options at all) can reuse it as its single
  // source of truth instead of a second, unreachable computation. Keyed on
  // the joined name list, not `visibleRoutes` itself, so this only
  // publishes when the actual visible set changes (e.g. role-driven
  // Confirmations visibility), not on every render.
  const visibleRouteNamesKey = visibleRoutes.map(({ route }) => route.name).join(",");
  useEffect(() => {
    setVisibleTabRouteNames(visibleRouteNamesKey ? visibleRouteNamesKey.split(",") : []);
  }, [visibleRouteNamesKey]);

  const activeEntry = visibleRoutes.find(({ index }) => index === state.index);

  // Keyed by route.key rather than a single "last known" value — every
  // visible tab's onLayout fires on mount (not just the active one), so by
  // the time the active tab changes, its position/width is almost always
  // already cached here and the switch can animate immediately instead of
  // waiting on a fresh layout pass.
  const tabLayoutsRef = useRef<Record<string, TabLayout>>({});
  const [hasMeasuredActive, setHasMeasuredActive] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const pillWidth = useRef(new Animated.Value(0)).current;

  // width isn't supported by the native driver, so both run on the JS
  // thread for one consistent animation — three tabs, occasional switches,
  // not a performance-sensitive path.
  const animateToLayout = useCallback(
    (layout: TabLayout, animate: boolean) => {
      if (animate) {
        Animated.parallel([
          Animated.spring(translateX, { toValue: layout.x, useNativeDriver: false, bounciness: 6 }),
          Animated.spring(pillWidth, { toValue: layout.width, useNativeDriver: false, bounciness: 6 }),
        ]).start();
      } else {
        translateX.setValue(layout.x);
        pillWidth.setValue(layout.width);
        setHasMeasuredActive(true);
      }
    },
    [translateX, pillWidth]
  );

  // Re-runs whenever the active tab changes (tap, or a deep link landing on
  // a different tab) — animates if this component already has a measured
  // baseline, otherwise leaves the initial snap-to-position to the active
  // tab's own onLayout below (avoids an ugly slide-in from (0,0) on mount).
  useEffect(() => {
    if (!activeEntry) return;
    const layout = tabLayoutsRef.current[activeEntry.route.key];
    if (layout) {
      animateToLayout(layout, hasMeasuredActive);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEntry?.route.key]);

  return (
    // DIP-FP-155-adj-1: the dark-mode gap wasn't the oval (container, using
    // colors.cardBackground, already correct) — it was this wrapper. Nothing
    // above it in the tree sets a background either (BottomTabView.js wraps
    // a custom tabBar with none; app/(app)/_layout.tsx's appShell is bare
    // flex:1; app/_layout.tsx has no styling at all) — confirmed live
    // against those sources. With no color of its own, this transparent
    // padding/safe-area strip fell through to the native root view's
    // default background (white), which only coincidentally matched light
    // mode's own background color.
    <View style={[styles.wrapper, { backgroundColor: colors.background, paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
      <View style={[styles.container, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.highlight,
            {
              transform: [{ translateX }],
              width: pillWidth,
              opacity: hasMeasuredActive ? 1 : 0,
            },
          ]}
        >
          <BlurView
            tint={isDark ? "dark" : "light"}
            intensity={80}
            style={[StyleSheet.absoluteFill, styles.highlightBlur, { backgroundColor: colors.accent + "26" }]}
          />
        </Animated.View>

        {visibleRoutes.map(({ route, index }) => {
          const options = descriptors[route.key].options;
          const isFocused = state.index === index;
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : (options.title ?? route.name);
          const badge = options.tabBarBadge;
          const Icon = ROUTE_ICONS[route.name] ?? Calendar;
          const isAlwaysAccent = ALWAYS_ACCENT_ROUTES.has(route.name);

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: "tabLongPress", target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              onLayout={(e: LayoutChangeEvent) => {
                const { x, width } = e.nativeEvent.layout;
                tabLayoutsRef.current[route.key] = { x, width };
                if (isFocused && !hasMeasuredActive) {
                  animateToLayout({ x, width }, false);
                }
              }}
              style={styles.tab}
              testID={`tab-${route.name}`}
            >
              <View>
                <Icon
                  size={22}
                  color={isFocused || isAlwaysAccent ? colors.accent : colors.textMuted}
                  strokeWidth={2}
                />
                {badge !== undefined ? (
                  <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.cardBackground }]}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                ) : null}
              </View>
              {/* DIP-FP-182-mobile-adj-1: always rendered, even when label
                  is "" (Dashboard) — an omitted Text element would still
                  likely end up the same height in practice, since
                  `container`'s row cross-axis defaults to stretch and every
                  Pressable ends up sized to the tallest sibling regardless of
                  its own content. But that's not something verifiable
                  without a running app, so this keeps the element structure
                  identical across every tab instead of relying on that
                  reasoning — the empty string simply renders no visible
                  text, satisfying the "same total visual footprint"
                  requirement without depending on an unverified assumption. */}
              <Text
                style={[styles.label, { color: isFocused ? colors.accent : colors.textMuted }]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // DIP-FP-155-adj-1: "sits too high" per Joseph's device testing — made the
  // bar itself more compact (less dead space above the oval, thinner oval)
  // so the whole thing sits lower and reads as a proper bottom bar rather
  // than floating mid-screen. paddingBottom (set inline above, from
  // insets.bottom) is deliberately untouched here — that value IS the home
  // indicator's safe clearance, not an arbitrary gap; reducing it below the
  // OS-reported inset would risk exactly the collision this DIP warns
  // against, and that's not something verifiable without a real device.
  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  container: {
    flexDirection: "row",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    paddingHorizontal: 6,
    overflow: "hidden",
  },
  highlight: {
    position: "absolute",
    top: 3,
    bottom: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  highlightBlur: {
    borderRadius: 999,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
});
