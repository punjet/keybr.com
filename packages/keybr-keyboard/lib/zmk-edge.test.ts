import { test } from "node:test";
import { deepEqual, equal, isTrue, throws } from "rich-assert";
import {
  makeZmkGeometry,
  parsePhysicalLayout,
  parseZmkKeymap,
  ZmkError,
} from "./zmk.ts";

// A 3x5+3 Corne in a different style: home row mods, numeric layer refs,
// a layer without display-name, comments everywhere, a nested layer.
const keymap = `
#include <behaviors.dtsi>
#define SYM 1
/* block comment with &kp X inside */
/ {
    behaviors {
        hrm: home_row_mods {
            compatible = "zmk,behavior-hold-tap";
            #binding-cells = <2>;
            flavor = "balanced";
            bindings = <&kp>, <&kp>;
        };
    };
    keymap {
        compatible = "zmk,keymap";
        base {
            bindings = <
&kp Q &kp W &kp E &kp R &kp T        &kp Y &kp U &kp I &kp O &kp P // top
&hrm LGUI A &hrm LALT S &hrm LCTRL D &hrm LSHFT F &kp G    &kp H &hrm RSHFT J &hrm RCTRL K &hrm RALT L &hrm RGUI SEMI
&kp Z &kp X &kp C &kp V &kp B        &kp N &kp M &kp COMMA &kp DOT &kp FSLH
          &kp ESC &lt SYM SPACE &mt LSHFT TAB    &kp ENTER &lt 2 SPACE &kp BSPC
            >;
        };
        sym_layer {
            bindings = <
&kp EXCL &kp AT &kp HASH &kp DLLR &kp PRCNT   &kp CARET &kp AMPS &kp STAR &kp LPAR &kp RPAR
&kp N1 &kp N2 &kp N3 &kp N4 &kp N5            &kp N6 &kp N7 &kp N8 &kp N9 &kp N0
&kp LC(C) &kp LC(V) &trans &kp MINUS &kp LS(EQUAL)   &kp LBKT &kp RBKT &kp SQT &none &mo 3
                  &trans &trans &trans        &trans &trans &trans
            >;
        };
        nav {
            display-name = "Nav";
            bindings = <
&trans &trans &trans &trans &trans   &kp LEFT &kp DOWN &kp UP &kp RIGHT &kp GRAVE
&trans &trans &trans &trans &trans   &trans &trans &trans &trans &trans
&trans &trans &trans &trans &trans   &trans &trans &trans &trans &trans
               &trans &trans &trans   &trans &trans &trans
            >;
        };
        deep {
            bindings = <
&kp BSLH &trans &trans &trans &trans   &trans &trans &trans &trans &trans
&trans &trans &trans &trans &trans   &trans &trans &trans &trans &trans
&trans &trans &trans &trans &trans   &trans &trans &trans &trans &trans
               &trans &trans &trans   &trans &trans &trans
            >;
        };
    };
};
`;

test("3x5 corne with home row mods and numeric layers", () => {
  const parsed = parseZmkKeymap(keymap);
  deepEqual(
    parsed.layers.map(({ name, bindings }) => [name, bindings.length]),
    [
      ["base", 36],
      ["sym_layer", 36],
      ["Nav", 36],
      ["deep", 36],
    ],
  );
  const g = makeZmkGeometry(parsed);
  const { dict } = g;
  equal(g.keys, 36);
  // Home row mods type their tap key.
  isTrue(dict["KeyA"] != null && dict["KeyA"].layer == null);
  isTrue(dict["Semicolon"] != null);
  deepEqual(dict["KeyF"].zones, ["leftIndex", "left", "home"]);
  isTrue(dict["KeyF"].homing === true);
  deepEqual(dict["KeyA"].zones, ["pinky", "left", "home"]);
  deepEqual(dict["KeyJ"].zones, ["rightIndex", "right", "home"]);
  // Thumbs: layer-taps activate layers, mod-tap types Tab.
  deepEqual(dict["Space"].zones, ["thumb", "left", "bottom"]);
  equal(dict["Space"].activates, "sym_layer");
  deepEqual(dict["Tab"].zones, ["thumb", "left", "bottom"]);
  equal(dict["Tab"].activates, undefined);
  const nav = Object.entries(dict).find(([, k]) => k.activates === "Nav");
  isTrue(nav != null && nav[0] !== "Space"); // The second space thumb.
  // "1" is on the A key and "!" on the Q key: the unshifted one wins.
  equal(dict["Digit1"].layer, "sym_layer");
  deepEqual(
    [dict["Digit1"].x, dict["Digit1"].y],
    [dict["KeyA"].x, dict["KeyA"].y],
  );
  deepEqual(
    [dict["Digit0"].x, dict["Digit0"].y],
    [dict["Semicolon"].x, dict["Semicolon"].y],
  );
  // "+" exists only as LS(EQUAL), so it still gets a place.
  equal(dict["Equal"].layer, "sym_layer");
  // Ctrl shortcuts type nothing, &none and &trans are skipped.
  equal(dict["KeyC"].layer, undefined);
  // Grave from the Nav layer, Backslash only on a nested layer: skipped.
  equal(dict["Backquote"].layer, "Nav");
  equal(dict["Backslash"], undefined);
  deepEqual(
    g.layers.map(({ name, keys }) => [name, keys]),
    [
      ["sym_layer", 15],
      ["Nav", 1],
    ],
  );
});

test("a physical layout with a wrong key count is ignored", () => {
  const physical = parsePhysicalLayout([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ]);
  const g = makeZmkGeometry(parseZmkKeymap(keymap), physical);
  equal(g.keys, 36);
});

test("physical layout formats", () => {
  equal(
    parsePhysicalLayout({ layouts: { a: { layout: [{ x: 1, y: 2 }] } } })!
      .length,
    1,
  );
  equal(parsePhysicalLayout([{ x: 1, y: 2, label: "enc" }])![0].label, "enc");
  equal(parsePhysicalLayout({ foo: 1 }), null);
  equal(parsePhysicalLayout([{ x: "a" }]), null);
});

test("broken keymaps", () => {
  throws(() => parseZmkKeymap(""), ZmkError);
  throws(
    () => parseZmkKeymap('/ { keymap { compatible = "zmk,keymap"; }; };'),
    ZmkError,
  );
});
