import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { deepEqual, equal, isTrue, throws } from "rich-assert";
import { Geometry } from "./geometry.ts";
import { Layout } from "./layout.ts";
import { loadKeyboard } from "./load.ts";
import {
  getZmkGeometry,
  makeZmkGeometry,
  parsePhysicalFile,
  parsePhysicalLayout,
  parseZmkKeymap,
  setZmkConfig,
  ZmkError,
} from "./zmk.ts";

const fixture = (name: string) =>
  readFileSync(resolve(import.meta.dirname, "zmk-fixtures", name), "utf8");

test("parse the eyelash corne keymap", () => {
  const keymap = parseZmkKeymap(fixture("eyelash_corne.keymap"));
  deepEqual(
    keymap.layers.map(({ name, bindings }) => [name, bindings.length]),
    [
      ["QWERTY", 48],
      ["NUM+SYM", 48],
      ["Fn", 48],
      ["AERO", 48],
    ],
  );
  deepEqual(keymap.layers[0].bindings[43], {
    behavior: "lt_hp",
    params: ["1", "LG(SPACE)"],
  });
});

test("build the geometry with the physical layout", () => {
  const keymap = parseZmkKeymap(fixture("eyelash_corne.keymap"));
  const physical = parsePhysicalLayout(
    JSON.parse(fixture("eyelash_corne.json")),
  );
  equal(physical!.length, 48);
  const geometry = makeZmkGeometry(keymap, physical, "Eyelash");
  // The joystick and the encoder are skipped: 42 real keys.
  equal(geometry.keys, 42);
  equal(geometry.skipped, 6);
  const base = Object.entries(geometry.dict).filter(([, k]) => k.layer == null);
  equal(base.length, 42);
  deepEqual(geometry.layers, [
    { name: "NUM+SYM", activator: "NUM+SYM", keys: 15 },
  ]);
  const { dict } = geometry;
  deepEqual(dict["KeyF"].zones, ["leftIndex", "left", "home"]);
  isTrue(dict["KeyF"].homing === true);
  deepEqual(dict["KeyJ"].zones, ["rightIndex", "right", "home"]);
  deepEqual(dict["KeyQ"].zones, ["pinky", "left", "top"]);
  deepEqual(dict["Space"].zones, ["thumb", "left", "bottom"]);
  equal(dict["ShiftLeft"].x, dict["KeyA"].x - 1);
  // NUM layer: "1" on the Q key, "-" on the F key.
  deepEqual(
    [dict["Digit1"].x, dict["Digit1"].y],
    [dict["KeyQ"].x, dict["KeyQ"].y],
  );
  equal(dict["Digit1"].layer, "NUM+SYM");
  deepEqual(
    [dict["Minus"].x, dict["Minus"].y],
    [dict["KeyF"].x, dict["KeyF"].y],
  );
  // "[" is already on the base layer.
  equal(dict["BracketLeft"].layer, undefined);
  const activator = Object.values(dict).find((k) => k.activates === "NUM+SYM");
  deepEqual(activator?.labels, [{ text: "NUM" }]);
});

test("build the geometry without the physical layout", () => {
  const keymap = parseZmkKeymap(fixture("eyelash_corne.keymap"));
  const geometry = makeZmkGeometry(keymap);
  // The split is recognized from the keymap: the middle keys are skipped.
  equal(geometry.keys, 42);
  equal(geometry.skipped, 6);
  isTrue(geometry.guessed);
  isTrue(geometry.dict["Digit1"] != null);
});

test("read the physical layout from the board devicetree", () => {
  const physical = parsePhysicalFile(fixture("eyelash_corne-layouts.dtsi"));
  equal(physical!.length, 48);
  deepEqual(physical![0], { w: 1, h: 1, x: 0, y: 0.37 });
  deepEqual(physical![45], { w: 1, h: 1, x: 11, y: 3.12 });
  const geometry = makeZmkGeometry(
    parseZmkKeymap(fixture("eyelash_corne.keymap")),
    physical,
  );
  // No labels in devicetree: the joystick and the encoder are found by the gap.
  equal(geometry.keys, 42);
  equal(geometry.guessed, false);
  equal(parsePhysicalFile(fixture("eyelash_corne.json"))!.length, 48);
  equal(parsePhysicalFile("/ { };"), null);
});

test("reject a file without a keymap", () => {
  throws(() => parseZmkKeymap("/ { };"), ZmkError);
});

test("register the uploaded config", () => {
  equal(getZmkGeometry(), null);
  const geometry = setZmkConfig({
    name: "Eyelash",
    keymap: fixture("eyelash_corne.keymap"),
    physical: fixture("eyelash_corne.json"),
  });
  equal(geometry!.keys, 42);
  const keyboard = loadKeyboard(Layout.RU_RU, Geometry.ZMK);
  equal(keyboard.getCombo(0x0439 /* й */)!.id, "KeyQ");
  equal(keyboard.getCombo(0x0031 /* 1 */)!.id, "Digit1");
  equal(keyboard.getShape("Digit1")!.layer, "NUM+SYM");
  setZmkConfig(null);
  equal(getZmkGeometry(), null);
});
