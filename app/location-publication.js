export const LOCATION_REPUBLISH_MS = 55_000;

export function shouldRepublishLocation({ watching, pending, visible, online, lastPost, now }) {
  return Boolean(watching && !pending && visible && online && now - lastPost >= LOCATION_REPUBLISH_MS);
}

export function shouldRevokeLocationPublication(error) {
  return Number(error?.code) === 1;
}
