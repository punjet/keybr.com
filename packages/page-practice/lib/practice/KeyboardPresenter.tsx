import { keyboardProps, useKeyboard } from "@keybr/keyboard";
import {
  flatten,
  getFrameSize,
  HeatmapLayer,
  KeyLayer,
  PointersLayer,
  TransitionsLayer,
  VirtualKeyboard,
  ZonesLayer,
} from "@keybr/keyboard-ui";
import { lessonProps, LessonType } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import { type CodePoint } from "@keybr/unicode";
import { withDeferred } from "@keybr/widget";
import { memo, type ReactNode } from "react";
import { type LastLesson } from "./state/index.ts";

export const KeyboardPresenter = memo(function KeyboardPresenter({
  focus,
  depressedKeys,
  toggledKeys,
  suffix,
  lastLesson,
}: {
  readonly focus: boolean;
  readonly depressedKeys: readonly string[];
  readonly toggledKeys: readonly string[];
  readonly suffix: readonly CodePoint[];
  readonly lastLesson: LastLesson | null;
}): ReactNode {
  const { settings } = useSettings();
  const keyboard = useKeyboard();
  const colors = settings.get(keyboardProps.colors);
  const pointers = settings.get(keyboardProps.pointers);
  // Letters only: the 42 physical keys. Symbol lessons: layer legends added.
  const layer = layerLessons.has(settings.get(lessonProps.type))
    ? "overlay"
    : "hide";
  // Keep the key size of a standard 5-row board for taller geometries,
  // instead of shrinking them.
  const height = Math.max(16, (16 * getFrameSize(keyboard).height) / 228);
  return (
    <VirtualKeyboard keyboard={keyboard} height={`${height}rem`}>
      <KeyLayer
        depressedKeys={depressedKeys}
        toggledKeys={toggledKeys}
        showColors={colors}
        layer={layer}
      />
      {focus && pointers && <PointersLayer suffix={suffix} />}
      {focus && lastLesson && (
        <HeatmapLayer histogram={flatten(lastLesson.misses)} modifier="m" />
      )}
      {focus && lastLesson && (
        <HeatmapLayer histogram={flatten(lastLesson.hits)} modifier="h" />
      )}
      {focus && lastLesson && (
        <TransitionsLayer histogram={lastLesson.misses2} modifier="m" />
      )}
      {focus && lastLesson && (
        <TransitionsLayer histogram={lastLesson.hits2} modifier="h" />
      )}
      {focus || <ZonesLayer />}
    </VirtualKeyboard>
  );
});

const layerLessons = new Set([
  LessonType.SYMBOLS,
  LessonType.NUMBERS,
  LessonType.CODE,
  LessonType.CUSTOM,
]);

export const DeferredKeyboardPresenter = withDeferred(KeyboardPresenter);
