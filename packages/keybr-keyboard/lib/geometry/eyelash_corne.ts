import { type GeometryDict } from "../types.ts";

// Eyelash Corne 3x6+3 split, ZMK keymap from punjet/zmk-new_corne (mac-aerospace).
// 42 keys like the real board. Keys of the NUM layer (held left FN thumb)
// share positions with base keys and are marked by the "digit" row zone.
export const EYELASH_CORNE: GeometryDict = {
  Tab: {
    x: 0,
    y: 0.375,
    labels: [{ text: "Tab" }],
    zones: ["pinky", "left", "top"],
  },
  KeyQ: {
    x: 1,
    y: 0.375,
    zones: ["pinky", "left", "top"],
  },
  KeyW: {
    x: 2,
    y: 0.125,
    zones: ["ring", "left", "top"],
  },
  KeyE: {
    x: 3,
    y: 0,
    zones: ["middle", "left", "top"],
  },
  KeyR: {
    x: 4,
    y: 0.125,
    zones: ["leftIndex", "left", "top"],
  },
  KeyT: {
    x: 5,
    y: 0.25,
    zones: ["leftIndex", "left", "top"],
  },
  KeyY: {
    x: 7,
    y: 0.25,
    zones: ["rightIndex", "right", "top"],
  },
  KeyU: {
    x: 8,
    y: 0.125,
    zones: ["rightIndex", "right", "top"],
  },
  KeyI: {
    x: 9,
    y: 0,
    zones: ["middle", "right", "top"],
  },
  KeyO: {
    x: 10,
    y: 0.125,
    zones: ["ring", "right", "top"],
  },
  KeyP: {
    x: 11,
    y: 0.375,
    zones: ["pinky", "right", "top"],
  },
  BracketLeft: {
    x: 12,
    y: 0.375,
    zones: ["pinky", "right", "top"],
  },
  ShiftLeft: {
    x: 0,
    y: 1.375,
    labels: [{ text: "Shift" }],
    zones: ["pinky", "left", "home"],
  },
  KeyA: {
    x: 1,
    y: 1.375,
    zones: ["pinky", "left", "home"],
  },
  KeyS: {
    x: 2,
    y: 1.125,
    zones: ["ring", "left", "home"],
  },
  KeyD: {
    x: 3,
    y: 1,
    zones: ["middle", "left", "home"],
  },
  KeyF: {
    x: 4,
    y: 1.125,
    zones: ["leftIndex", "left", "home"],
    homing: true,
  },
  KeyG: {
    x: 5,
    y: 1.25,
    zones: ["leftIndex", "left", "home"],
  },
  KeyH: {
    x: 7,
    y: 1.25,
    zones: ["rightIndex", "right", "home"],
  },
  KeyJ: {
    x: 8,
    y: 1.125,
    zones: ["rightIndex", "right", "home"],
    homing: true,
  },
  KeyK: {
    x: 9,
    y: 1,
    zones: ["middle", "right", "home"],
  },
  KeyL: {
    x: 10,
    y: 1.125,
    zones: ["ring", "right", "home"],
  },
  Semicolon: {
    x: 11,
    y: 1.375,
    zones: ["pinky", "right", "home"],
  },
  Quote: {
    x: 12,
    y: 1.375,
    zones: ["pinky", "right", "home"],
  },
  ControlLeft: {
    x: 0,
    y: 2.375,
    labels: [{ text: "Ctrl" }],
    zones: ["pinky", "left", "bottom"],
  },
  KeyZ: {
    x: 1,
    y: 2.375,
    zones: ["pinky", "left", "bottom"],
  },
  KeyX: {
    x: 2,
    y: 2.125,
    zones: ["ring", "left", "bottom"],
  },
  KeyC: {
    x: 3,
    y: 2,
    zones: ["middle", "left", "bottom"],
  },
  KeyV: {
    x: 4,
    y: 2.125,
    zones: ["leftIndex", "left", "bottom"],
  },
  KeyB: {
    x: 5,
    y: 2.25,
    zones: ["leftIndex", "left", "bottom"],
  },
  KeyN: {
    x: 7,
    y: 2.25,
    zones: ["rightIndex", "right", "bottom"],
  },
  KeyM: {
    x: 8,
    y: 2.125,
    zones: ["rightIndex", "right", "bottom"],
  },
  Comma: {
    x: 9,
    y: 2,
    zones: ["middle", "right", "bottom"],
  },
  Period: {
    x: 10,
    y: 2.125,
    zones: ["ring", "right", "bottom"],
  },
  Slash: {
    x: 11,
    y: 2.375,
    zones: ["pinky", "right", "bottom"],
  },
  Backspace: {
    x: 12,
    y: 2.375,
    labels: [{ text: "Bksp" }],
    zones: ["pinky", "right", "bottom"],
  },
  MetaLeft: {
    x: 3,
    y: 3.5,
    labels: [{ text: "Cmd" }],
    zones: ["thumb", "left", "bottom"],
  },
  LayerNum: {
    x: 4,
    y: 3.6,
    labels: [{ text: "FN" }],
    zones: ["thumb", "left", "bottom"],
  },
  Space: {
    x: 5,
    y: 3.75,
    labels: [{ text: "Space" }],
    zones: ["thumb", "left", "bottom"],
  },
  Enter: {
    x: 7,
    y: 3.75,
    labels: [{ text: "Enter" }],
    zones: ["thumb", "right", "bottom"],
  },
  LayerAero: {
    x: 8,
    y: 3.6,
    labels: [{ text: "Hyper" }],
    zones: ["thumb", "right", "bottom"],
  },
  Escape: {
    x: 9,
    y: 3.5,
    labels: [{ text: "Esc" }],
    zones: ["thumb", "right", "bottom"],
  },
  Digit1: {
    x: 1,
    y: 0.375,
    zones: ["pinky", "left", "digit"],
  },
  Digit2: {
    x: 2,
    y: 0.125,
    zones: ["ring", "left", "digit"],
  },
  Digit3: {
    x: 3,
    y: 0,
    zones: ["middle", "left", "digit"],
  },
  Digit4: {
    x: 4,
    y: 0.125,
    zones: ["leftIndex", "left", "digit"],
  },
  Digit5: {
    x: 5,
    y: 0.25,
    zones: ["leftIndex", "left", "digit"],
  },
  Digit6: {
    x: 7,
    y: 0.25,
    zones: ["rightIndex", "right", "digit"],
  },
  Digit7: {
    x: 8,
    y: 0.125,
    zones: ["rightIndex", "right", "digit"],
  },
  Digit8: {
    x: 9,
    y: 0,
    zones: ["middle", "right", "digit"],
  },
  Digit9: {
    x: 10,
    y: 0.125,
    zones: ["ring", "right", "digit"],
  },
  Digit0: {
    x: 11,
    y: 0.375,
    zones: ["pinky", "right", "digit"],
  },
  Backslash: {
    x: 12,
    y: 0.375,
    zones: ["pinky", "right", "digit"],
  },
  Backquote: {
    x: 1,
    y: 1.375,
    zones: ["pinky", "left", "digit"],
  },
  BracketRight: {
    x: 3,
    y: 1,
    zones: ["middle", "left", "digit"],
  },
  Minus: {
    x: 4,
    y: 1.125,
    zones: ["leftIndex", "left", "digit"],
  },
  Equal: {
    x: 5,
    y: 1.25,
    zones: ["leftIndex", "left", "digit"],
  },
};
