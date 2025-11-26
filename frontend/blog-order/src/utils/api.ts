export const normalizeBaseUrl = (url?: string) => {
  if (!url) {
    return typeof window !== "undefined" ? window.location.origin : "";
  }
  const trimmed = url.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
};

export const API_HOST = normalizeBaseUrl(
  import.meta.env.VITE_REACT_APP_API_URL
);
export const API_VERSION = import.meta.env.VITE_REACT_APP_API_VERSION || "1";

export const apiBase = (pathSegment?: string) => {
  if (!pathSegment) return `${API_HOST}/v${API_VERSION}`;
  return `${API_HOST}/v${API_VERSION}/${pathSegment.replace(/^\/+/, "")}`;
};
