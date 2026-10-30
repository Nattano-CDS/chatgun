import assert from "node:assert/strict";
import test from "node:test";

import {
  chatViewportHeight,
  isLikelyChatKeyboardOpen,
} from "../app/chat-viewport.js";

test("legacy mobile fallback treats composer focus as an open software keyboard", () => {
  assert.equal(isLikelyChatKeyboardOpen({
    composerFocused: true,
    compactViewport: true,
    hasVisualViewport: false,
    layoutViewportHeight: 915,
    visualViewportHeight: 915,
  }), true);
  assert.equal(isLikelyChatKeyboardOpen({
    composerFocused: false,
    compactViewport: true,
    hasVisualViewport: false,
    layoutViewportHeight: 915,
    visualViewportHeight: 915,
  }), false);
});

test("responsive desktop does not imitate a keyboard when visual viewport is unchanged", () => {
  assert.equal(isLikelyChatKeyboardOpen({
    composerFocused: true,
    compactViewport: true,
    hasVisualViewport: true,
    layoutViewportHeight: 900,
    visualViewportHeight: 900,
  }), false);
});

test("visual viewport compression detects a keyboard independently of focus timing", () => {
  assert.equal(isLikelyChatKeyboardOpen({
    layoutViewportHeight: 915,
    visualViewportHeight: 500,
  }), true);
});

test("open keyboard does not reserve the bottom navigation gap twice", () => {
  const common = {
    viewportHeight: 500,
    layoutTop: 44,
    navigationHeight: 72,
  };
  assert.equal(chatViewportHeight({ ...common, keyboardOpen: true }), 456);
  assert.equal(chatViewportHeight({ ...common, keyboardOpen: false }), 376);
});

test("panned visual viewport uses its actual bottom edge", () => {
  assert.equal(chatViewportHeight({
    viewportHeight: 500,
    viewportOffsetTop: 140,
    layoutTop: 44,
    keyboardOpen: true,
  }), 596);
});

test("chat viewport preserves its minimum only while the keyboard is closed", () => {
  assert.equal(chatViewportHeight({ viewportHeight: 220, layoutTop: 20, keyboardOpen: false }), 260);
  assert.equal(chatViewportHeight({ viewportHeight: 220, layoutTop: 20, keyboardOpen: true }), 200);
});
