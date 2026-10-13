import { type WordList } from "@keybr/content";
import { type Keyboard } from "@keybr/keyboard";
import { Letter, type PhoneticModel } from "@keybr/phonetic-model";
import {
  randomSample,
  type RNGStream,
  weightedRandomSample,
} from "@keybr/rand";
import { type KeyStatsMap } from "@keybr/result";
import { type Settings } from "@keybr/settings";
import { type CodePoint } from "@keybr/unicode";
import { needOf } from "./adaptive.ts";
import { filterWordList } from "./dictionary.ts";
import { LessonKey, LessonKeys } from "./key.ts";
import { Lesson } from "./lesson.ts";
import { lessonProps } from "./settings.ts";
import { Target } from "./target.ts";
import { generateFragment } from "./text/fragment.ts";

/**
 * Trains digits and punctuation together with real words.
 *
 * On a split keyboard these characters live on a held layer, so the hard
 * part is switching between the base layer and the layer in the middle
 * of a word stream. Every symbol token is surrounded by ordinary words,
 * and the weakest symbols (slow or error prone) appear most often.
 */
export class SymbolsLesson extends Lesson {
  readonly #symbols: readonly Letter[];
  readonly #words: readonly string[];

  constructor(
    settings: Settings,
    keyboard: Keyboard,
    model: PhoneticModel,
    wordList: WordList,
  ) {
    super(settings, keyboard, model);
    // AltGr symbols (like ₽) are not reachable on the Mac layouts in use.
    this.#symbols = findSymbols(keyboard.getCodePoints({ alt: false }));
    this.#words = filterWordList(wordList, this.codePoints)
      .filter((word) => word.length > 1 && word.length <= 8)
      .slice(0, 1000);
  }

  override get letters() {
    return this.#symbols;
  }

  override update(keyStatsMap: KeyStatsMap) {
    const target = new Target(this.settings);
    const lessonKeys = new LessonKeys(
      this.#symbols.map((letter) =>
        LessonKey.from(keyStatsMap.get(letter), target).asIncluded(),
      ),
    );
    const maxFrequency = Math.max(...this.#symbols.map(({ f }) => f));
    let focused: LessonKey | null = null;
    let focusedNeed = 0;
    for (const key of lessonKeys) {
      const need = needOf(key, maxFrequency);
      if (need > focusedNeed) {
        focused = key;
        focusedNeed = need;
      }
    }
    if (focused != null) {
      lessonKeys.focus(focused.letter);
    }
    return lessonKeys;
  }

  override generate(lessonKeys: LessonKeys, rng: RNGStream) {
    const wordsBetween = this.settings.get(lessonProps.symbols.wordsBetween);
    const maxFrequency = Math.max(...this.#symbols.map(({ f }) => f));
    const weighted = [...lessonKeys].map((key) => ({
      codePoint: key.letter.codePoint,
      weight: (0.3 + needOf(key, maxFrequency)) * (key.isFocused ? 3 : 1),
    }));
    const word = () =>
      this.#words.length > 0 ? randomSample(this.#words, rng) : "abc";
    let between = 0;
    return generateFragment(this.settings, () => {
      if (between > 0) {
        between--;
        return word();
      }
      between = wordsBetween;
      const { codePoint } = weightedRandomSample(
        weighted,
        ({ weight }) => weight,
        rng,
      );
      return symbolToken(codePoint, word, rng);
    });
  }
}

function findSymbols(codePoints: Iterable<CodePoint>): Letter[] {
  const symbols: Letter[] = [];
  for (const codePoint of codePoints) {
    const char = String.fromCodePoint(codePoint);
    const isLetter = char.toLowerCase() !== char.toUpperCase();
    if (codePoint > 0x0020 && !isLetter) {
      symbols.push(new Letter(codePoint, frequencyOf(codePoint)));
    }
  }
  return symbols;
}

function frequencyOf(codePoint: CodePoint): number {
  const punctuator = Letter.punctuators.find((l) => l.codePoint === codePoint);
  if (punctuator != null) {
    return punctuator.f;
  }
  if (codePoint >= 0x0030 && codePoint <= 0x0039) {
    return 3;
  }
  return 1;
}

function number(rng: RNGStream, digit: string | null = null): string {
  const length = 1 + Math.floor(rng() * 3);
  let value = "";
  for (let i = 0; i < length; i++) {
    value += String(Math.floor(rng() * 10));
  }
  if (digit != null) {
    const at = Math.floor(rng() * (value.length + 1));
    value = value.slice(0, at) + digit + value.slice(at);
  }
  return value;
}

function symbolToken(
  codePoint: CodePoint,
  word: () => string,
  rng: RNGStream,
): string {
  const s = String.fromCodePoint(codePoint);
  if (codePoint >= 0x0030 && codePoint <= 0x0039) {
    return number(rng, s);
  }
  switch (s) {
    case ".":
    case ",":
    case "!":
    case "?":
    case ":":
    case ";":
      return `${word()}${s}`;
    case '"':
    case "'":
    case "`":
      return `${s}${word()}${s}`;
    case "(":
    case ")":
      return `(${word()})`;
    case "[":
    case "]":
      return `[${word()}]`;
    case "{":
    case "}":
      return `{${word()}}`;
    case "<":
    case ">":
      return `<${word()}>`;
    case "%":
      return `${number(rng)}%`;
    case "№":
    case "#":
    case "$":
      return `${s}${number(rng)}`;
    case "@":
      return `@${word()}`;
    case "+":
    case "*":
    case "=":
    case "^":
      return `${number(rng)}${s}${number(rng)}`;
    case "-":
      return rng() < 0.5 ? `${word()}-${word()}` : `${word()} - ${word()}`;
    default:
      return `${word()}${s}${word()}`;
  }
}
