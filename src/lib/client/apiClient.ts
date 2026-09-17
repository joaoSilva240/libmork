// =============================================================================
// Libmork — API Client (typed fetch wrapper)
// =============================================================================
// Thin wrapper over fetch that returns parsed JSON and throws on errors.
// Uses CSRF-aware fetch under the hood.
// =============================================================================

import { apiFetch as csrfApiFetch } from "./csrf";

export async function apiFetch<T>(
  endpoint: string,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers);
  
  // Set default Content-Type for JSON bodies
  if (init?.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await csrfApiFetch(endpoint, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // If response body is not JSON, use statusText
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}
