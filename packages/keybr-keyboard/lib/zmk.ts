import { type GeometryDict, type KeyId, type ZoneId } from "./types.ts";

/**
 * Builds a keyboard geometry from a ZMK keymap (`.keymap`, devicetree) and,
 * optionally, a physical layout (ZMK Studio / QMK `info.json` style JSON with
 * `x`, `y` of every key in the binding order).
 *
 * The base layer gives the physical keys. Keys which produce characters on
 * held layers (digits, symbols on a NUM layer) are placed at the positions
 * of the physical keys they share and marked with the layer name, and the
 * base keys which activate the layers are marked as activators.
 */

export type ZmkBinding = {
  /** Behavior name without `&`, like `kp`, `mo`, `lt`. */
  readonly behavior: string;
  readonly params: readonly string[];
};

export type ZmkLayer = {
  readonly name: string;
  readonly bindings: readonly ZmkBinding[];
  /** Bindings grouped by source lines, used when no physical layout. */
  readonly rows: readonly number[];
};

export type ZmkKeymap = {
  readonly layers: readonly ZmkLayer[];
  readonly behaviors: ReadonlyMap<string, ZmkBehavior>;
};

type ZmkBehavior =
  | { readonly kind: "hold-tap"; readonly hold: string; readonly tap: string }
  | { readonly kind: "tap-dance"; readonly first: ZmkBinding | null }
  | {
      readonly kind: "macro";
      readonly layer: string | null;
      readonly label: string;
    };

export type PhysicalKey = {
  readonly x: number;
  readonly y: number;
  readonly w?: number;
  readonly h?: number;
  readonly row?: number;
  readonly label?: string;
};

export type ZmkGeometry = {
  readonly name: string;
  readonly dict: GeometryDict;
  /** Character layers with their activators. */
  readonly layers: readonly {
    readonly name: string;
    readonly activator: string;
    readonly keys: number;
  }[];
  readonly keys: number;
  readonly skipped: number;
  /** No physical layout was given, positions are guessed from the keymap. */
  readonly guessed: boolean;
};

export class ZmkError extends Error {}

// --- Parsing ---

export function parseZmkKeymap(text: string): ZmkKeymap {
  const source = stripComments(text);
  const defines = new Map<string, string>();
  for (const [, name, value] of source.matchAll(
    /^\s*#define\s+(\w+)\s+(\S+)/gm,
  )) {
    defines.set(name, value);
  }
  const behaviors = parseBehaviors(source, defines);
  const keymap = findBlock(source, /compatible\s*=\s*"zmk,keymap"/);
  if (keymap == null) {
    throw new ZmkError("Cannot find the zmk,keymap node");
  }
  const layers: ZmkLayer[] = [];
  for (const { name, body } of childNodes(keymap)) {
    const bindings = /bindings\s*=\s*<([^>]*)>/.exec(
      body.replace(/sensor-bindings\s*=\s*<[^>]*>/g, ""),
    );
    if (bindings == null) {
      continue;
    }
    const displayName = /display-name\s*=\s*"([^"]*)"/.exec(body);
    const rows: number[] = [];
    const all: ZmkBinding[] = [];
    for (const line of bindings[1].split("\n")) {
      const list = parseBindings(line, defines);
      if (list.length > 0) {
        rows.push(list.length);
        all.push(...list);
      }
    }
    layers.push({
      name: displayName?.[1] ?? name,
      bindings: all,
      rows,
    });
  }
  if (layers.length === 0) {
    throw new ZmkError("The keymap has no layers");
  }
  return { layers, behaviors };
}

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** Finds the `{ ... }` block which contains the given marker. */
function findBlock(source: string, marker: RegExp): string | null {
  const match = marker.exec(source);
  if (match == null) {
    return null;
  }
  let depth = 0;
  let start = match.index;
  for (; start >= 0; start--) {
    const c = source[start];
    if (c === "}") {
      depth++;
    } else if (c === "{") {
      if (depth === 0) {
        break;
      }
      depth--;
    }
  }
  const end = matchingBrace(source, start);
  return start >= 0 && end > start ? source.slice(start + 1, end) : null;
}

function matchingBrace(source: string, open: number): number {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") {
      depth++;
    } else if (source[i] === "}") {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

/** Direct child nodes `name { ... };` and `label: name { ... };`. */
function childNodes(
  block: string,
): { name: string; label: string | null; body: string }[] {
  const nodes = [];
  const re = /(?:(\w+)\s*:\s*)?([\w-]+)\s*\{/g;
  let match;
  while ((match = re.exec(block)) != null) {
    const open = match.index + match[0].length - 1;
    const close = matchingBrace(block, open);
    if (close < 0) {
      break;
    }
    nodes.push({
      label: match[1] ?? null,
      name: match[2],
      body: block.slice(open + 1, close),
    });
    re.lastIndex = close + 1;
  }
  return nodes;
}

function parseBehaviors(
  source: string,
  defines: ReadonlyMap<string, string>,
): Map<string, ZmkBehavior> {
  const behaviors = new Map<string, ZmkBehavior>();
  const re = /(\w+)\s*:\s*[\w-]+\s*\{/g;
  let match;
  while ((match = re.exec(source)) != null) {
    const open = match.index + match[0].length - 1;
    const close = matchingBrace(source, open);
    if (close < 0) {
      break;
    }
    const label = match[1];
    const body = source.slice(open + 1, close);
    const compatible = /compatible\s*=\s*"([^"]+)"/.exec(body)?.[1];
    const bindings = /bindings\s*=\s*([\s\S]*?);/.exec(body)?.[1] ?? "";
    const displayName = /display-name\s*=\s*"([^"]*)"/.exec(body)?.[1];
    switch (compatible) {
      case "zmk,behavior-hold-tap": {
        const [hold = "kp", tap = "kp"] = [
          ...bindings.matchAll(/<\s*&(\w+)/g),
        ].map((m) => m[1]);
        behaviors.set(label, { kind: "hold-tap", hold, tap });
        break;
      }
      case "zmk,behavior-tap-dance": {
        const first = /<([^>]*)>/.exec(bindings)?.[1];
        behaviors.set(label, {
          kind: "tap-dance",
          first:
            first != null ? (parseBindings(first, defines)[0] ?? null) : null,
        });
        break;
      }
      case "zmk,behavior-macro": {
        const ref = /&mo\s+(\w+)/.exec(bindings)?.[1] ?? null;
        behaviors.set(label, {
          kind: "macro",
          layer: ref != null ? (defines.get(ref) ?? ref) : null,
          // The node label is short enough for a key cap.
          label:
            displayName != null && displayName.length <= 6
              ? displayName
              : label,
        });
        break;
      }
    }
    // Keep scanning inside the node too, behaviors are nested in `behaviors { }`.
    re.lastIndex = open + 1;
  }
  return behaviors;
}

/** Splits `&kp A &lt 1 B &kp LG(LS(N4))` into bindings. */
function parseBindings(
  text: string,
  defines: ReadonlyMap<string, string>,
): ZmkBinding[] {
  const tokens: string[] = [];
  let depth = 0;
  let token = "";
  for (const c of text) {
    if (c === "(") {
      depth++;
    } else if (c === ")") {
      depth--;
    }
    if (/\s/.test(c) && depth === 0) {
      if (token) {
        tokens.push(token);
      }
      token = "";
    } else {
      token += c;
    }
  }
  if (token) {
    tokens.push(token);
  }
  const bindings: { behavior: string; params: string[] }[] = [];
  for (const t of tokens) {
    if (t.startsWith("&")) {
      bindings.push({ behavior: t.slice(1), params: [] });
    } else if (bindings.length > 0) {
      bindings[bindings.length - 1].params.push(defines.get(t) ?? t);
    }
  }
  return bindings;
}

// --- Key codes ---

type Code = {
  readonly id: KeyId;
  /** A key which types a character with the OS layout. */
  readonly char: boolean;
  /** Typed with Shift, like `EXCL` or `LS(N1)`. */
  readonly shifted?: boolean;
  readonly label?: string;
};

/** Key code names which mean the shifted character of a key. */
const shiftedNames = new Set(
  (
    "UNDER UNDERSCORE PLUS LBRC LEFT_BRACE RBRC RIGHT_BRACE PIPE COLON " +
    "DQT DOUBLE_QUOTES TILDE LT LESS_THAN GT GREATER_THAN QMARK QUESTION " +
    "EXCL EXCLAMATION AT AT_SIGN HASH POUND DLLR DOLLAR PRCNT PERCENT CARET " +
    "AMPS AMPERSAND STAR ASTRK ASTERISK LPAR LEFT_PARENTHESIS " +
    "RPAR RIGHT_PARENTHESIS"
  ).split(" "),
);

const charCodes = new Map<string, KeyId>();
const otherCodes = new Map<string, [KeyId, string]>();

for (let i = 0; i < 26; i++) {
  const c = String.fromCharCode(65 + i);
  charCodes.set(c, `Key${c}`);
}
for (let i = 0; i <= 9; i++) {
  charCodes.set(`N${i}`, `Digit${i}`);
  charCodes.set(`NUMBER_${i}`, `Digit${i}`);
}
for (const [id, names] of [
  ["Minus", "MINUS UNDER UNDERSCORE"],
  ["Equal", "EQUAL PLUS"],
  ["BracketLeft", "LBKT LEFT_BRACKET LBRC LEFT_BRACE"],
  ["BracketRight", "RBKT RIGHT_BRACKET RBRC RIGHT_BRACE"],
  ["Backslash", "BSLH BACKSLASH PIPE"],
  ["IntlBackslash", "NON_US_BSLH NON_US_BACKSLASH"],
  ["Semicolon", "SEMI SEMICOLON COLON"],
  ["Quote", "SQT APOS APOSTROPHE SINGLE_QUOTE DQT DOUBLE_QUOTES"],
  ["Backquote", "GRAVE TILDE"],
  ["Comma", "COMMA LT LESS_THAN"],
  ["Period", "DOT PERIOD GT GREATER_THAN"],
  ["Slash", "FSLH SLASH QMARK QUESTION"],
  ["Digit1", "EXCL EXCLAMATION"],
  ["Digit2", "AT AT_SIGN"],
  ["Digit3", "HASH POUND"],
  ["Digit4", "DLLR DOLLAR"],
  ["Digit5", "PRCNT PERCENT"],
  ["Digit6", "CARET"],
  ["Digit7", "AMPS AMPERSAND"],
  ["Digit8", "STAR ASTRK ASTERISK"],
  ["Digit9", "LPAR LEFT_PARENTHESIS"],
  ["Digit0", "RPAR RIGHT_PARENTHESIS"],
] as const) {
  for (const name of names.split(" ")) {
    charCodes.set(name, id);
  }
}
for (const [id, label, names] of [
  ["Space", "Space", "SPACE"],
  ["Enter", "Enter", "ENTER RET RETURN"],
  ["Backspace", "Bksp", "BSPC BACKSPACE"],
  ["Tab", "Tab", "TAB"],
  ["Escape", "Esc", "ESC ESCAPE"],
  ["Delete", "Del", "DEL DELETE"],
  ["ShiftLeft", "Shift", "LSHFT LSHIFT LEFT_SHIFT"],
  ["ShiftRight", "Shift", "RSHFT RSHIFT RIGHT_SHIFT"],
  ["ControlLeft", "Ctrl", "LCTRL LCTL LEFT_CONTROL"],
  ["ControlRight", "Ctrl", "RCTRL RCTL RIGHT_CONTROL"],
  ["AltLeft", "Alt", "LALT LEFT_ALT"],
  ["AltRight", "Alt", "RALT RIGHT_ALT"],
  ["MetaLeft", "Cmd", "LGUI LEFT_GUI LCMD LWIN LMETA LEFT_COMMAND"],
  ["MetaRight", "Cmd", "RGUI RIGHT_GUI RCMD RWIN RMETA RIGHT_COMMAND"],
  ["CapsLock", "Caps", "CAPS CAPSLOCK CAPS_LOCK"],
  ["ArrowUp", "↑", "UP UP_ARROW"],
  ["ArrowDown", "↓", "DOWN DOWN_ARROW"],
  ["ArrowLeft", "←", "LEFT LEFT_ARROW"],
  ["ArrowRight", "→", "RIGHT RIGHT_ARROW"],
  ["Home", "Home", "HOME"],
  ["End", "End", "END"],
  ["PageUp", "PgUp", "PG_UP PAGE_UP"],
  ["PageDown", "PgDn", "PG_DN PAGE_DOWN"],
] as const) {
  for (const name of names.split(" ")) {
    otherCodes.set(name, [id, label]);
  }
}

/** Resolves a `&kp` parameter like `A`, `LS(N1)`, `LG(SPACE)`. */
function codeOf(param: string): Code | null {
  let code = param;
  let modified = false;
  let shifted = false;
  let match;
  while ((match = /^(\w+)\((.*)\)$/.exec(code)) != null) {
    const [, fn, inner] = match;
    if (fn === "LS" || fn === "RS") {
      shifted = true;
    } else {
      modified = true; // Ctrl, Alt or Cmd shortcuts type no characters.
    }
    code = inner;
  }
  const charId = charCodes.get(code);
  if (charId != null && !modified) {
    return {
      id: charId,
      char: true,
      shifted: shifted || shiftedNames.has(code),
    };
  }
  const other = otherCodes.get(code);
  if (other != null && !modified) {
    return { id: other[0], char: false, label: other[1] };
  }
  return { id: "", char: false, label: shortLabel(param) };
}

function shortLabel(param: string): string {
  return param.replace(/^C_/, "").replace(/_/g, " ").slice(0, 6);
}

type Resolved = {
  /** The key typed on tap. */
  readonly code: Code | null;
  /** The layer held, as a name or a number. */
  readonly layer: string | null;
  readonly label: string | null;
};

function resolve(binding: ZmkBinding, keymap: ZmkKeymap, depth = 0): Resolved {
  const { behavior, params } = binding;
  switch (behavior) {
    case "kp":
    case "kt":
      return { code: codeOf(params[0] ?? ""), layer: null, label: null };
    case "mo":
    case "sl":
    case "tog":
    case "to":
      return { code: null, layer: params[0] ?? null, label: null };
    case "lt":
      return {
        code: codeOf(params[1] ?? ""),
        layer: params[0] ?? null,
        label: null,
      };
    case "mt":
      return { code: codeOf(params[1] ?? ""), layer: null, label: null };
    case "trans":
    case "none":
      return { code: null, layer: null, label: null };
  }
  const custom = keymap.behaviors.get(behavior);
  switch (custom?.kind) {
    case "hold-tap": {
      const layer = custom.hold === "mo" ? (params[0] ?? null) : null;
      const tap = custom.tap === "kp" ? codeOf(params[1] ?? "") : null;
      return { code: tap, layer, label: null };
    }
    case "tap-dance":
      return custom.first != null && depth < 3
        ? resolve(custom.first, keymap, depth + 1)
        : { code: null, layer: null, label: behavior };
    case "macro":
      return { code: null, layer: custom.layer, label: custom.label };
  }
  return { code: null, layer: null, label: behavior.slice(0, 6) };
}

function layerName(keymap: ZmkKeymap, ref: string | null): string | null {
  if (ref == null) {
    return null;
  }
  const index = Number(ref);
  if (Number.isInteger(index)) {
    return keymap.layers[index]?.name ?? null;
  }
  return null;
}

// --- Geometry ---

/**
 * Reads the first `zmk,physical-layout` node of a devicetree file, like
 * `boards/shields/<board>/<board>-layouts.dtsi`, in hundredths of a key.
 */
export function parsePhysicalDtsi(text: string): PhysicalKey[] | null {
  const source = stripComments(text);
  const node = findBlock(source, /compatible\s*=\s*"zmk,physical-layout"/);
  if (node == null) {
    return null;
  }
  const keys: PhysicalKey[] = [];
  const num = String.raw`\(?\s*(-?\d+)\s*\)?`;
  const re = new RegExp(
    String.raw`&key_physical_attrs\s+` +
      [num, num, num, num].join(String.raw`\s+`),
    "g",
  );
  for (const [, w, h, x, y] of node.matchAll(re)) {
    keys.push({
      w: Number(w) / 100,
      h: Number(h) / 100,
      x: Number(x) / 100,
      y: Number(y) / 100,
    });
  }
  return keys.length > 0 ? keys : null;
}

/** A physical layout file: ZMK Studio / QMK JSON or ZMK devicetree. */
export function parsePhysicalFile(text: string): PhysicalKey[] | null {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parsePhysicalLayout(JSON.parse(trimmed));
  }
  return parsePhysicalDtsi(text);
}

export function parsePhysicalLayout(json: unknown): PhysicalKey[] | null {
  const list = findKeyList(json);
  if (list == null) {
    return null;
  }
  return list.map((k) => ({
    x: Number(k.x),
    y: Number(k.y),
    w: k.w != null ? Number(k.w) : undefined,
    h: k.h != null ? Number(k.h) : undefined,
    row: k.row != null ? Number(k.row) : undefined,
    label: typeof k.label === "string" ? k.label : undefined,
  }));
}

function findKeyList(json: any): any[] | null {
  if (Array.isArray(json)) {
    return json.every(
      (k) => k != null && Number.isFinite(k.x) && Number.isFinite(k.y),
    )
      ? json
      : null;
  }
  if (json != null && typeof json === "object") {
    if (json.layouts != null && typeof json.layouts === "object") {
      for (const layout of Object.values<any>(json.layouts)) {
        const list = findKeyList(layout?.layout);
        if (list != null) {
          return list;
        }
      }
    }
    if (json.layout != null) {
      return findKeyList(json.layout);
    }
  }
  return null;
}

export function makeZmkGeometry(
  keymap: ZmkKeymap,
  physical: readonly PhysicalKey[] | null = null,
  name = "ZMK",
): ZmkGeometry {
  const [base] = keymap.layers;
  const count = base.bindings.length;
  const guessed = physical == null || physical.length !== count;
  const positions = guessed ? gridPositions(base.rows) : physical;
  // Joysticks and encoders: labeled positions of a physical layout, and keys
  // in the gap between the two halves of a split keyboard.
  const extras = gapExtras(positions);
  const kept: number[] = [];
  for (let i = 0; i < count; i++) {
    if (positions[i].label == null && !extras.has(i)) {
      kept.push(i);
    }
  }
  const zones = assignZones(kept.map((i) => positions[i]));
  const zonesAt = new Map(kept.map((i, n) => [i, zones[n]]));

  const dict: Record<string, GeometryDict[string]> = {};
  const activators = new Map<string, string>();
  for (const i of kept) {
    const { code, layer, label } = resolve(base.bindings[i], keymap);
    const { x, y } = positions[i];
    const z = zonesAt.get(i)!;
    const held = layerName(keymap, layer);
    let id = code?.id || "";
    if (id === "" || dict[id] != null) {
      id = `Zmk${i}`;
    }
    const text = held != null ? capLabel(held) : (code?.label ?? label);
    dict[id] = {
      x,
      y,
      zones: z.zones,
      ...(z.homing ? { homing: true } : {}),
      ...(text != null && !(code?.char ?? false) ? { labels: [{ text }] } : {}),
      ...(held != null ? { activates: held } : {}),
    };
    if (held != null && !activators.has(held)) {
      activators.set(held, held);
    }
  }

  // A key has a single position in keybr. When a layer has both "1" and
  // "!" on different keys, the unshifted one wins, so place all unshifted
  // characters of all layers first and the shifted ones after them.
  const reachable = keymap.layers
    .slice(1)
    .filter(
      (layer) => activators.has(layer.name) && layer.bindings.length === count,
    );
  const counts = new Map<string, number>();
  for (const pass of [false, true]) {
    for (const layer of reachable) {
      for (const i of kept) {
        const { code } = resolve(layer.bindings[i], keymap);
        if (
          code?.char &&
          code.id !== "" &&
          (code.shifted ?? false) === pass &&
          dict[code.id] == null
        ) {
          const z = zonesAt.get(i)!;
          dict[code.id] = {
            x: positions[i].x,
            y: positions[i].y,
            zones: z.zones,
            layer: layer.name,
          };
          counts.set(layer.name, (counts.get(layer.name) ?? 0) + 1);
        }
      }
    }
  }
  const layers = reachable
    .filter((layer) => counts.has(layer.name))
    .map((layer) => ({
      name: layer.name,
      activator: activators.get(layer.name)!,
      keys: counts.get(layer.name)!,
    }));
  return {
    name,
    dict,
    layers,
    keys: kept.length,
    skipped: count - kept.length,
    guessed,
  };
}

/** A layer name short enough for a key cap: "NUM+SYM" becomes "NUM". */
function capLabel(name: string): string {
  return name.length <= 5
    ? name
    : (name.split(/[^\p{L}\p{N}]+/u)[0] || name).slice(0, 5);
}

/**
 * Positions from the line structure of the base layer source.
 *
 * A split keyboard is recognized by its thumb row (see below): then the first
 * and the last `half` keys of every letter row are the two halves, keys in
 * between are joysticks or encoders, and thumbs go under the inner columns.
 */
function gridPositions(rows: readonly number[]): PhysicalKey[] {
  const letters = rows.slice(0, -1);
  const thumbs = rows[rows.length - 1];
  const half = Math.floor(Math.min(...letters) / 2);
  // Equal even letter rows with a shorter thumb row, or extra keys in the
  // middle of the letter rows with a thumb row no wider than a half.
  const even = letters.every((l) => l === letters[0] && l % 2 === 0);
  const split =
    letters.length >= 2 &&
    half >= 3 &&
    ((even && thumbs < letters[0]) || thumbs <= half);
  const positions: PhysicalKey[] = [];
  if (!split) {
    const widest = Math.max(...rows);
    rows.forEach((length, row) => {
      const offset = (widest - length) / 2;
      for (let col = 0; col < length; col++) {
        positions.push({ x: offset + col, y: row, row });
      }
    });
    return positions;
  }
  letters.forEach((length, row) => {
    for (let col = 0; col < length; col++) {
      if (col < half) {
        positions.push({ x: col, y: row, row });
      } else if (col >= length - half) {
        positions.push({ x: half + 1 + (col - (length - half)), y: row, row });
      } else {
        positions.push({ x: half, y: row, row, label: "extra" });
      }
    }
  });
  const left = Math.ceil(thumbs / 2);
  for (let col = 0; col < thumbs; col++) {
    const x = col < left ? half - left + col : half + 1 + (col - left);
    positions.push({ x, y: letters.length, row: letters.length });
  }
  return positions;
}

/**
 * Keys standing in the gap between the two halves of a split keyboard
 * (a joystick, an encoder), found row by row from the physical positions:
 * the halves are runs of adjacent keys from the left and the right edges.
 */
function gapExtras(positions: readonly PhysicalKey[]): Set<number> {
  const extras = new Set<number>();
  const rowOf = (k: PhysicalKey) => k.row ?? Math.round(k.y);
  const rows = new Map<number, number[]>();
  positions.forEach((k, i) => {
    rows.set(rowOf(k), [...(rows.get(rowOf(k)) ?? []), i]);
  });
  const lastRow = Math.max(...rows.keys());
  for (const [row, list] of rows) {
    if (row === lastRow && lastRow >= 3) {
      continue; // Thumb keys are spread out on purpose.
    }
    const sorted = list
      .filter((i) => positions[i].label == null)
      .sort((a, b) => positions[a].x - positions[b].x);
    const adjacent = (a: number, b: number) =>
      Math.abs(positions[b].x - positions[a].x) <= 1.15;
    let l = 0;
    while (l + 1 < sorted.length && adjacent(sorted[l], sorted[l + 1])) {
      l++;
    }
    let r = sorted.length - 1;
    while (r - 1 > l && adjacent(sorted[r - 1], sorted[r])) {
      r--;
    }
    if (l >= 1 && sorted.length - r >= 2 && r - l > 1) {
      for (let i = l + 1; i < r; i++) {
        extras.add(sorted[i]);
      }
    }
  }
  return extras;
}

function assignZones(
  keys: readonly PhysicalKey[],
): { zones: ZoneId[]; homing: boolean }[] {
  const xs = keys.map(({ x }) => x);
  const mid = (Math.min(...xs) + Math.max(...xs) + 1) / 2;
  const rowOf = (k: PhysicalKey) => k.row ?? Math.round(k.y);
  const lastRow = Math.max(...keys.map(rowOf));
  const thumbRow = lastRow >= 3 ? lastRow : -1;
  const letterRows = thumbRow >= 0 ? thumbRow : lastRow + 1;
  const rowZones: ZoneId[] =
    letterRows >= 4
      ? ["digit", "top", "home", "bottom"]
      : ["top", "home", "bottom"];
  const columns = (hand: "left" | "right") => {
    const list = keys
      .filter((k) => rowOf(k) !== thumbRow && k.x < mid === (hand === "left"))
      .map(({ x }) => Math.round(x * 2) / 2);
    const unique = [...new Set(list)];
    // Inner columns first.
    return unique.sort((a, b) => (hand === "left" ? b - a : a - b));
  };
  const left = columns("left");
  const right = columns("right");
  return keys.map((k) => {
    const hand = k.x < mid ? "left" : "right";
    const row = rowOf(k);
    if (row === thumbRow) {
      return { zones: ["thumb", hand, "bottom"], homing: false };
    }
    const cols = hand === "left" ? left : right;
    const col = cols.indexOf(Math.round(k.x * 2) / 2);
    const finger: ZoneId =
      col <= 1
        ? hand === "left"
          ? "leftIndex"
          : "rightIndex"
        : col === 2
          ? "middle"
          : col === 3
            ? "ring"
            : "pinky";
    const rowZone = rowZones[Math.min(row, rowZones.length - 1)] ?? "bottom";
    return {
      zones: [finger, hand, rowZone],
      homing: rowZone === "home" && col === 1,
    };
  });
}

// --- Registry ---

const storageKey = "zmk.config";

export type ZmkConfig = {
  readonly name: string;
  readonly keymap: string;
  readonly physical: string | null;
};

let current: { config: ZmkConfig; geometry: ZmkGeometry } | null = null;
let loaded = false;

export function buildZmkConfig(config: ZmkConfig): ZmkGeometry {
  const keymap = parseZmkKeymap(config.keymap);
  const physical =
    config.physical != null ? parsePhysicalFile(config.physical) : null;
  return makeZmkGeometry(keymap, physical, config.name);
}

/** The uploaded ZMK geometry of this browser, if any. */
export function getZmkGeometry(): ZmkGeometry | null {
  if (!loaded) {
    loaded = true;
    try {
      const json = globalThis.localStorage?.getItem(storageKey);
      if (json != null) {
        const config = JSON.parse(json) as ZmkConfig;
        current = { config, geometry: buildZmkConfig(config) };
      }
    } catch {
      current = null;
    }
  }
  return current?.geometry ?? null;
}

export function getZmkConfig(): ZmkConfig | null {
  getZmkGeometry();
  return current?.config ?? null;
}

/** Validates, stores and activates a config, or removes it with null. */
export function setZmkConfig(config: ZmkConfig | null): ZmkGeometry | null {
  loaded = true;
  if (config == null) {
    current = null;
    globalThis.localStorage?.removeItem(storageKey);
    return null;
  }
  const geometry = buildZmkConfig(config);
  current = { config, geometry };
  globalThis.localStorage?.setItem(storageKey, JSON.stringify(config));
  return geometry;
}
