// Replays a downloaded keybr typing-data.json through the original and
// adaptive guided algorithms, prints unlock points and sample texts:
//   cd packages/keybr-lesson
//   REPLAY=~/Downloads/typing-data.json npx tstest --import=@keybr/test-env-bundler --test tools/replay.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { Geometry, Layout, loadKeyboard } from "@keybr/keyboard";
import { loadModelSync } from "@keybr/phonetic-model/lib/fs-load.ts";
import { LCG } from "@keybr/rand";
import { makeKeyStatsMap, Result, TextType } from "@keybr/result";
import { Settings } from "@keybr/settings";
import { Histogram } from "@keybr/textinput";
import { effectiveConfidence, needOf } from "../lib/adaptive.ts";
import { GuidedLesson } from "../lib/guided.ts";
import { lessonProps } from "../lib/settings.ts";
import { SymbolsLesson } from "../lib/symbols.ts";

test("replay user data", () => {
  const json = JSON.parse(readFileSync(process.env.REPLAY!, "utf8"));
  const results = json.map(
    (r: any) =>
      new Result(
        Layout.ALL.get(r.layout),
        TextType.ALL.get(r.textType),
        Date.parse(r.timeStamp),
        r.length,
        r.time,
        r.errors,
        new Histogram(r.histogram),
      ),
  );
  const layout = results[0].layout;
  const keyboard = loadKeyboard(layout, Geometry.EYELASH_CORNE);
  const { model } = loadModelSync(layout.language);
  const words = JSON.parse(
    readFileSync(
      resolve(
        import.meta.dirname,
        `../../keybr-content-words/lib/data/words-${layout.language.id}.json`,
      ),
      "utf8",
    ),
  );
  for (const adaptive of [false, true]) {
    const settings = new Settings().set(lessonProps.guided.adaptive, adaptive);
    const lesson = new GuidedLesson(settings, keyboard, model, words);
    const unlocks: string[] = [];
    let prev = 0;
    let lessonKeys = null;
    for (let i = 0; i <= results.length; i++) {
      lessonKeys = lesson.update(
        makeKeyStatsMap(lesson.letters, results.slice(0, i)),
      );
      const included = lessonKeys.findIncludedKeys();
      if (included.length > prev) {
        if (prev > 0) {
          unlocks.push(`${included.at(-1)!.letter.label}@${i}`);
        }
        prev = included.length;
      }
    }
    console.log(`\n=== adaptive=${adaptive}`);
    console.log("letters:", lesson.letters.map((l) => l.label).join(""));
    console.log("unlocks:", unlocks.join(" "));
    const included = lessonKeys!.findIncludedKeys();
    const maxF = Math.max(...included.map(({ letter }) => letter.f));
    console.log(
      "keys:",
      included
        .map(
          (k) =>
            `${k.letter.label}${k.isFocused ? "*" : ""}` +
            `(c=${k.confidence?.toFixed(2)} e=${effectiveConfidence(k)?.toFixed(2)} n=${needOf(k, maxF).toFixed(2)})`,
        )
        .join(" "),
    );
    if (adaptive) {
      console.log(
        "weak bigrams:",
        lesson
          .weakBigrams(lessonKeys!, 15)
          .map(([b, n]) => `${b}:${n.toFixed(2)}`)
          .join(" "),
      );
    }
    const rng = LCG(1);
    console.log("text:", String(lesson.generate(lessonKeys!, rng)));
    console.log("text:", String(lesson.generate(lessonKeys!, rng)));
  }

  const symbols = new SymbolsLesson(new Settings(), keyboard, model, words);
  const keys = symbols.update(makeKeyStatsMap(symbols.letters, results));
  console.log("\n=== symbols:", symbols.letters.map((l) => l.label).join(" "));
  console.log("text:", String(symbols.generate(keys, LCG(2))));
});
