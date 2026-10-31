export const CHAT_KEYBOARD_THRESHOLD_PX = 150;

export function isLikelyChatKeyboardOpen({
  composerFocused = false,
  compactViewport = false,
  hasVisualViewport = true,
  layoutViewportHeight = 0,
  visualViewportHeight = layoutViewportHeight,
  threshold = CHAT_KEYBOARD_THRESHOLD_PX,
} = {}) {
  const visualReduction = Number(layoutViewportHeight) - Number(visualViewportHeight);
  return visualReduction > threshold || (!hasVisualViewport && composerFocused && compactViewport);
}

export function chatViewportHeight({
  viewportHeight,
  viewportOffsetTop = 0,
  layoutTop = 0,
  navigationHeight = 0,
  keyboardOpen = false,
  minimum = 260,
  gutter = 8,
} = {}) {
  const reservedNavigation = keyboardOpen ? 0 : Math.max(0, Number(navigationHeight) || 0);
  const reservedGutter = keyboardOpen ? 0 : Math.max(0, Number(gutter) || 0);
  const minimumHeight = keyboardOpen ? 0 : Math.max(0, Number(minimum) || 0);
  return Math.max(
    minimumHeight,
    (Number(viewportHeight) || 0) + (Number(viewportOffsetTop) || 0)
      - (Number(layoutTop) || 0) - reservedNavigation - reservedGutter,
  );
}
