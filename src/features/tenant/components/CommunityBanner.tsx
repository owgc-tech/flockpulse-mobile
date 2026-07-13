import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { fetchTenantSettings } from "@/src/features/tenant/services/tenant.service";

// FP-118: fetched once on mount, no caching — this data (community name/
// logo) changes rarely, unlike the role-sync issue from FP-96-FP-97-adj-1,
// so there's no equivalent staleness risk to guard against here. On
// failure, the banner just renders with its fallbacks (name → "Community",
// no logo) rather than blocking or erroring the whole app shell over it —
// same non-fatal precedent as web's AdminShellLayout.
export function CommunityBanner() {
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
    <View style={styles.container} testID="community-banner">
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
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  textColumn: {
    flexShrink: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },
  poweredBy: {
    fontSize: 12,
    color: "#999",
    marginTop: 1,
  },
});
