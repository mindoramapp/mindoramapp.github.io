const SAFE_NODE_URL_PROTOCOLS = new Set(["http:", "https:"]);

export const PASSWORD_MIN_LENGTH = 10;

export const validatePasswordPolicy = (password: string): string | null => {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres`;
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return "Use pelo menos 1 letra maiúscula, 1 minúscula e 1 número";
  }

  return null;
};

export const sanitizeNodeUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("/")) {
    // "//host" and "/\host" are protocol-relative URLs that browsers resolve to another site.
    if (/^\/[/\\]/.test(trimmed)) return "";
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (!SAFE_NODE_URL_PROTOCOLS.has(parsed.protocol)) {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
};

export const isSafeNodeUrl = (value?: string | null): value is string => {
  if (!value) return false;
  return sanitizeNodeUrl(value) === value;
};

/** Largest picture kept inside a map (a data URL, about 150 KB of image). */
export const NODE_IMAGE_MAX_CHARS = 200_000;

/** Only raster pictures embedded as base64 data URLs (no SVG, no remote addresses). */
export const isSafeNodeImage = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= NODE_IMAGE_MAX_CHARS &&
  /^data:image\/(?:webp|jpeg|png|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
