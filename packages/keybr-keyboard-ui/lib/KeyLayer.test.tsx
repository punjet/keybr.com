import { test } from "node:test";
import {
  Geometry,
  KeyboardContext,
  Layout,
  loadKeyboard,
} from "@keybr/keyboard";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { deepEqual, equal } from "rich-assert";
import { KeyLayer } from "./KeyLayer.tsx";

test("render", () => {
  const keyboard = loadKeyboard(Layout.EN_US);

  const r = render(
    <KeyboardContext.Provider value={keyboard}>
      <KeyLayer />
    </KeyboardContext.Provider>,
  );

  equal(r.container.querySelectorAll(".key").length, 58);
  equal(r.container.querySelectorAll(".depressedKey").length, 0);
  equal(r.container.querySelectorAll(".symbol").length, 78);

  r.unmount();
});

test("update", () => {
  const keyboard = loadKeyboard(Layout.EN_US);

  const r = render(
    <KeyboardContext.Provider value={keyboard}>
      <KeyLayer
        depressedKeys={["KeyA", "KeyB", "KeyC"]}
        toggledKeys={["CapsLock", "NumLock"]}
      />
    </KeyboardContext.Provider>,
  );

  equal(r.container.querySelectorAll(".key").length, 58);
  equal(r.container.querySelectorAll(".depressedKey").length, 3);
  equal(r.container.querySelectorAll(".symbol").length, 78);

  r.unmount();
});

test("events", async () => {
  const keyboard = loadKeyboard(Layout.EN_US);

  const events: string[] = [];

  const r = render(
    <KeyboardContext.Provider value={keyboard}>
      <KeyLayer
        onKeyHoverIn={(key) => {
          events.push(`hover in ${key}`);
        }}
        onKeyHoverOut={(key) => {
          events.push(`hover out ${key}`);
        }}
        onKeyClick={(key) => {
          events.push(`click ${key}`);
        }}
      />
    </KeyboardContext.Provider>,
  );

  events.length = 0;
  await userEvent.hover(r.getByText("A"));
  deepEqual(events, ["hover in KeyA"]);

  events.length = 0;
  await userEvent.unhover(r.getByText("A"));
  deepEqual(events, ["hover out KeyA"]);

  events.length = 0;
  await userEvent.click(r.getByText("A"));
  deepEqual(events, ["hover in KeyA", "click KeyA"]);

  r.unmount();
});

test("split keyboard layer", () => {
  const keyboard = loadKeyboard(Layout.RU_RU, Geometry.EYELASH_CORNE);

  const hide = render(
    <KeyboardContext.Provider value={keyboard}>
      <KeyLayer depressedKeys={["Digit1"]} />
    </KeyboardContext.Provider>,
  );

  // Only the 42 physical keys, a layer key lights its physical key.
  equal(hide.container.querySelectorAll(".key").length, 42);
  equal(hide.container.querySelectorAll(".layerKey").length, 0);
  deepEqual(
    [...hide.container.querySelectorAll(".depressedKey")].map(
      (e) => (e as SVGElement).dataset["key"],
    ),
    ["KeyQ"],
  );

  hide.unmount();

  const overlay = render(
    <KeyboardContext.Provider value={keyboard}>
      <KeyLayer layer="overlay" />
    </KeyboardContext.Provider>,
  );

  // Still 42 buttons, layer symbols are legends on them.
  equal(overlay.container.querySelectorAll(".key").length, 42);
  equal(overlay.container.querySelectorAll(".layerKey").length, 15);

  overlay.unmount();
});
