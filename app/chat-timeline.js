export const CHAT_BOTTOM_THRESHOLD = 80;

export function compareTimelineMessages(left, right) {
  const time = Number(left.created_at) - Number(right.created_at);
  if (time) return time;
  const leftId = String(left.id), rightId = String(right.id);
  if (leftId !== rightId) return leftId < rightId ? -1 : 1;
  return Number(Boolean(left.system)) - Number(Boolean(right.system));
}

export function timelineMessageKey(message) {
  return `${message.system ? "system" : "message"}:${String(message.id)}`;
}

export function mergeTimelineMessages(current, incoming) {
  const messages = new Map(current.map((message) => [timelineMessageKey(message), message]));
  for (const message of incoming) messages.set(timelineMessageKey(message), message);
  return [...messages.values()].sort(compareTimelineMessages);
}

export function isNearTimelineBottom(element, threshold = CHAT_BOTTOM_THRESHOLD) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}
