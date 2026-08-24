import type { NextRequest } from "next/server";

const INTERNAL_REDIRECT_ROOTS = ["/login", "/invite", "/player", "/master"];

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::]", "[::1]"]);

function isPublicOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      !LOOPBACK_HOSTS.has(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

function getForwardedOrigin(request: NextRequest): string | null {
  const host = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const protocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",", 1)[0]
    ?.trim()
    .toLowerCase();

  if (
    !host ||
    !protocol ||
    /[\x00-\x20\x7f\r\n]/.test(host) ||
    !/^(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:.]+\])(?::\d{1,5})?$/i.test(host) ||
    (protocol !== "http" && protocol !== "https")
  ) {
    return null;
  }

  const origin = `${protocol}://${host}`;
  return isPublicOrigin(origin) ? new URL(origin).origin : null;
}

/** Returns the best valid public origin for an authentication redirect. */
export function getPublicOrigin(request: NextRequest): string {
  const requestOrigin = request.nextUrl.origin;

  if (isPublicOrigin(requestOrigin)) return requestOrigin;

  const forwardedOrigin = getForwardedOrigin(request);
  if (forwardedOrigin) return forwardedOrigin;

  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredOrigin && isPublicOrigin(configuredOrigin)) {
    return new URL(configuredOrigin).origin;
  }

  return requestOrigin;
}

/**
 * Returns a normalized path only when the destination is an allowed internal
 * authentication destination. Redirects must stay relative so an internal
 * proxy origin can never leak into a Location header.
 */
export function getSafeRedirect(
  value: string | null | undefined,
  origin?: string,
): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\r\n\u0000]/.test(value)
  ) {
    return null;
  }

  try {
    const base = origin ? new URL(origin) : new URL("http://internal.invalid");
    const destination = new URL(value, base);
    if (destination.origin !== base.origin) {
      return null;
    }

    const path = destination.pathname;
    const isAllowed = INTERNAL_REDIRECT_ROOTS.some(
      (root) => path === root || path.startsWith(`${root}/`),
    );
    if (!isAllowed) {
      return null;
    }

    return `${path}${destination.search}${destination.hash}`;
  } catch {
    return null;
  }
}
