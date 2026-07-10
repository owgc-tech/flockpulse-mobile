import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/src/lib/supabase";
import { clearDeviceTrust } from "@/src/features/auth/services/biometricTrust.service";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      lastUserIdRef.current = data.session?.user.id ?? null;
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // FP-93: SIGNED_OUT also fires when the refresh token is revoked
      // elsewhere (e.g. a password reset from web) and the client's own
      // refresh attempt fails — not only on an explicit local signOut().
      // Either way, the trusted-device flag must not survive: the next
      // app open needs full password + TOTP before biometric unlock
      // resumes. FP-92's guard (never fall back to biometric alone on an
      // invalid/expired/revoked session) depends on this cleanup running.
      if (event === "SIGNED_OUT" && lastUserIdRef.current) {
        clearDeviceTrust(lastUserIdRef.current).catch(() => {});
      }

      // Caveat carried over from this DIP's Grounding Check: password
      // reset/change revokes the refresh token, but an already-issued
      // access token stays valid until it expires — so this device won't
      // actually hit SIGNED_OUT (and won't be forced to re-verify) until
      // that access token expires or a refresh is attempted. Whether that
      // happens "immediately" depends on the project's access-token expiry
      // being configured short in the Supabase Dashboard; this DIP doesn't
      // change that setting, only documents the dependency.

      setSession(nextSession);
      lastUserIdRef.current = nextSession?.user.id ?? null;
      setIsLoading(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return { session, isLoading };
}
