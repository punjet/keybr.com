import { type Keyboard, type KeyId, type KeyShape } from "@keybr/keyboard";

/**
 * How to show the keys of a held layer on split keyboards (like the NUM layer
 * of a Corne): hidden, or as extra legends on the physical keys they share.
 */
export type LayerMode = "hide" | "overlay";

/** Whether the shape is a key of a held layer, not of the base layer. */
export function isLayerShape(_keyboard: Keyboard, shape: KeyShape): boolean {
  return shape.layer != null;
}

/** The key which activates the layer of the given shape while held. */
export function layerActivator(
  keyboard: Keyboard,
  shape: KeyShape,
): KeyShape | null {
  if (shape.layer == null) {
    return null;
  }
  for (const other of keyboard.shapes.values()) {
    if (other.activates === shape.layer) {
      return other;
    }
  }
  return null;
}

/** Maps every layer key to the physical base key at the same position. */
export function layerBaseKeys(keyboard: Keyboard): Map<KeyId, KeyId> {
  const map = new Map<KeyId, KeyId>();
  const shapes = [...keyboard.shapes.values()];
  for (const shape of shapes) {
    if (isLayerShape(keyboard, shape)) {
      const base = shapes.find(
        (other) =>
          other !== shape &&
          !isLayerShape(keyboard, other) &&
          other.x === shape.x &&
          other.y === shape.y,
      );
      if (base != null) {
        map.set(shape.id, base.id);
      }
    }
  }
  return map;
}
