import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { deepEqual } from "rich-assert";
import { EYELASH_CORNE } from "./geometry/eyelash_corne.ts";
import { makeZmkGeometry, parsePhysicalLayout, parseZmkKeymap } from "./zmk.ts";

const fixture = (name: string) =>
  readFileSync(resolve(import.meta.dirname, "zmk-fixtures", name), "utf8");

// The hand-made Corne geometry was built from the same keymap by hand.
test("cross-check with the hand-made geometry", () => {
  const z = makeZmkGeometry(
    parseZmkKeymap(fixture("eyelash_corne.keymap")),
    parsePhysicalLayout(JSON.parse(fixture("eyelash_corne.json"))),
  ).dict;
  const h = EYELASH_CORNE;
  // Relative grid position: rank of x and of y among base keys.
  const problems: string[] = [];
  // Activators have generated ids in the zmk geometry.
  const alias: Record<string, string> = {};
  for (const [id, k] of Object.entries<any>(z)) {
    if (id.startsWith("Zmk")) {
      alias[id] = k.activates === "NUM+SYM" ? "LayerNum" : "LayerAero";
    }
  }
  const named = (id: string) => alias[id] ?? id;
  const zz: any = Object.fromEntries(
    Object.entries(z).map(([id, k]) => [named(id), k]),
  );
  // Left-to-right order of base keys in every hand row.
  const rows = (dict: any) => {
    const groups = new Map<string, [number, string][]>();
    for (const [id, k] of Object.entries<any>(dict)) {
      if (k.layer == null) {
        const g = `${k.zones[1]}/${k.zones[2]}${k.zones[0] === "thumb" ? "/thumb" : ""}`;
        groups.set(g, [...(groups.get(g) ?? []), [k.x, id]]);
      }
    }
    return Object.fromEntries(
      [...groups].map(([g, l]) => [
        g,
        l
          .sort((a, b) => a[0] - b[0])
          .map(([, id]) => id)
          .join(" "),
      ]),
    );
  };
  const rz = rows(zz);
  const rh = rows(h);
  for (const g of new Set([...Object.keys(rz), ...Object.keys(rh)])) {
    if (rz[g] !== rh[g]) problems.push(`row ${g}: ${rz[g]} | ${rh[g]}`);
  }
  const ids = new Set([...Object.keys(zz), ...Object.keys(h)]);
  for (const id of [...ids].sort()) {
    const a = zz[id];
    const b = h[id];
    if (a == null || b == null) {
      problems.push(`${id}: only in ${a == null ? "hand-made" : "zmk"}`);
      continue;
    }
    if (JSON.stringify(a.zones) !== JSON.stringify(b.zones)) {
      problems.push(`${id}: zones zmk=${a.zones} hand=${b.zones}`);
    }
    if ((a.layer != null) !== (b.layer != null)) {
      problems.push(`${id}: layer zmk=${a.layer} hand=${b.layer}`);
    }
    if (!!a.homing !== !!b.homing) {
      problems.push(`${id}: homing zmk=${a.homing} hand=${b.homing}`);
    }
    if (a.layer != null) {
      // Layer key must sit exactly on a base key.
      const onZ = Object.entries<any>(zz).find(
        ([, o]) => o.layer == null && o.x === a.x && o.y === a.y,
      )?.[0];
      const onH = Object.entries<any>(h).find(
        ([, o]) => o.layer == null && o.x === b.x && o.y === b.y,
      )?.[0];
      if (onZ !== onH) {
        problems.push(`${id}: on zmk=${onZ} hand=${onH}`);
      }
    }
  }
  deepEqual(problems, []);
});
