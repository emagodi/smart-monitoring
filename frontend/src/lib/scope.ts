import { useMemo } from "react";
import { useAuth, type AuthUser } from "../context/AuthContext";

/**
 * What part of the estate a user works with. The backend applies the same rule to every query
 * (AccessScopeService): partner users see their partner's transformers, depot users see their depot,
 * everyone else sees the whole country. The frontend uses it to hide pages that make no sense for
 * a narrower scope (e.g. the district list for a depot user).
 */
export type Scope = "NATIONAL" | "DEPOT" | "PARTNER";

const ADMIN_ROLE = /^(ROLE[_-])?(ADMIN|ADMINISTRATOR|SUPER_?ADMIN)$/i;

export function scopeOf(user: AuthUser | null | undefined, roles: string[] = []): Scope {
  if (!user) return "NATIONAL";
  if (user.supplierCode || (user.userType || "").toLowerCase() === "supplier") return "PARTNER";
  if (roles.some((r) => ADMIN_ROLE.test(String(r)))) return "NATIONAL";
  if (user.depotId != null) return "DEPOT";
  return "NATIONAL";
}

export function useScope() {
  const { user, roles } = useAuth();
  return useMemo(() => {
    const scope = scopeOf(user, roles);
    return {
      scope,
      isNational: scope === "NATIONAL",
      isDepot: scope === "DEPOT",
      isPartner: scope === "PARTNER",
      depotId: user?.depotId ?? null,
      supplierCode: user?.supplierCode || null,
      supplierName: user?.supplierName || null,
    };
  }, [user, roles]);
}
