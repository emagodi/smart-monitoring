import axios from "axios";

/**
 * Partner display names. The partner is "Oqulus"; older records and the backend still carry the
 * misspelt "Oculus". Codes (supplierCode = "oculus") are identifiers and are never changed, only
 * the text people read.
 */
const MISSPELT = /\bOculus\b/g;
const MISSPELT_UPPER = /\bOCULUS\b/g;

export const displayName = (value?: string | null) =>
  value == null ? "" : String(value).replace(MISSPELT, "Oqulus").replace(MISSPELT_UPPER, "OQULUS");

/** Friendly partner label: "Oqulus", falls back to a prettified code. */
export const displayPartner = (name?: string | null, code?: string | null) => {
  if (name && name.trim()) return displayName(name.trim());
  if (code && code.trim()) {
    const c = code.trim();
    return displayName(c.charAt(0).toUpperCase() + c.slice(1));
  }
  return "No partner";
};

// Keys whose string values are human-readable partner / supplier text.
const TEXT_KEY = /(supplier|partner|vendor).*(name|label|title)$|^(supplierName|supplier_name|scopeSupplierName|partnerName|name|title|label|message|description)$/i;

const rebrand = (value: unknown, key = "", depth = 0): unknown => {
  if (depth > 8 || value == null) return value;
  if (typeof value === "string") {
    return TEXT_KEY.test(key) && (value.includes("Oculus") || value.includes("OCULUS")) ? displayName(value) : value;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = rebrand(value[i], key, depth + 1);
    return value;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const k of Object.keys(obj)) obj[k] = rebrand(obj[k], k, depth + 1);
    return obj;
  }
  return value;
};

let installed = false;

/** Rewrites partner names in every API response once, so every screen shows "Oqulus". */
export function installBrandInterceptor() {
  if (installed) return;
  installed = true;
  axios.interceptors.response.use((response) => {
    const type = String(response.headers?.["content-type"] ?? "");
    if (response.data && typeof response.data === "object" && (!type || type.includes("json"))) {
      rebrand(response.data);
    }
    return response;
  });
}
