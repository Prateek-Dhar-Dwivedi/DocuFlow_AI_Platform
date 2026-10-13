import { CONFIG } from "../config";

export function validateApiKey(request: Request): { valid: boolean; error?: string } {
  // If no key configured in production, log warning
  if (!CONFIG.UIPATH_API_KEY) {
    return { valid: true };
  }

  // 1. Check Bearer token in Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token === CONFIG.UIPATH_API_KEY) {
      return { valid: true };
    }
  }

  // 2. Check x-api-key header
  const xApiKey = request.headers.get("x-api-key");
  if (xApiKey && xApiKey.trim() === CONFIG.UIPATH_API_KEY) {
    return { valid: true };
  }

  // 3. Check URL search param fallback
  const url = new URL(request.url);
  const queryKey = url.searchParams.get("api_key");
  if (queryKey && queryKey === CONFIG.UIPATH_API_KEY) {
    return { valid: true };
  }

  return {
    valid: false,
    error: "Unauthorized: Missing or invalid API key. Provide via 'Authorization: Bearer <KEY>' or 'x-api-key' header.",
  };
}
