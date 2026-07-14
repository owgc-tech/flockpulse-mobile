import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/src/features/profile/components/Avatar";
import { fetchTenantSettings } from "@/src/features/tenant/services/tenant.service";

// FP-118: fetched once on mount, no caching — this data (community name/
// logo) changes rarely, unlike the role-sync issue from FP-96-FP-97-adj-1,
// so there's no equivalent staleness risk to guard against here. On
// failure, the banner just renders with its fallbacks (name → "Community",
// no logo) rather than blocking or erroring the whole app shell over it —
// same non-fatal precedent as web's AdminShellLayout.
//
// FP-118 round 2: Avatar now lives here (a global control, not tied to any
// one screen's subject matter) instead of per-screen headerRight — folded
// into one row with the logo/name so there's a single banner rather than
// two stacked ones. paddingTop is insets.top + 8, not a fixed value, so
// this never collides with the status bar/notch on any device — the actual
// bug report that prompted this restructure.
export function CommunityBanner() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchTenantSettings()
      .then((settings) => {
        setName(settings.name);
        setLogoUrl(settings.logo_url);
      })
      .catch(() => {
        // Non-fatal — banner renders with fallbacks.
      });
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]} testID="community-banner">
      <View style={styles.left}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={styles.logo} testID="community-banner-logo" />
        ) : null}
        <View style={styles.textColumn}>
          <Text style={styles.name} numberOfLines={1}>
            {name ?? "Community"}
          </Text>
          <Text style={styles.poweredBy}>Powered by FlockPulse</Text>
        </View>
      </View>
      <Avatar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  textColumn: {
    flexShrink: 1,
  },
  name: {
    fontSize: 19,
    fontWeight: "700",
    color: "#111",
  },
  poweredBy: {
    fontSize: 12,
    color: "#999",
    marginTop: 1,
  },
});
