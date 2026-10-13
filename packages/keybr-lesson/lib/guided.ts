import { type WordList } from "@keybr/content";
import { type Keyboard } from "@keybr/keyboard";
import { Filter, Letter, type PhoneticModel } from "@keybr/phonetic-model";
import { type RNGStream, weightedRandomSample } from "@keybr/rand";
import { type KeyStatsMap, speedToTime, timeToSpeed } from "@keybr/result";
import { type Settings } from "@keybr/settings";
import { adaptive, meanConfidence, needOf } from "./adaptive.ts";
import { bigramNeed, bigramStore, geometryDifficulty } from "./bigrams.ts";
import { confusionStore } from "./confusions.ts";
import { Dictionary, filterWordList } from "./dictionary.ts";
import { LessonKey, LessonKeys } from "./key.ts";
import { Lesson } from "./lesson.ts";
import { lessonProps } from "./settings.ts";
import { Target } from "./target.ts";
import { generateFragment } from "./text/fragment.ts";
import {
  mangledWords,
  phoneticWords,
  randomWords,
  uniqueWords,
  type WordGenerator,
} from "./text/words.ts";

export class GuidedLesson extends Lesson {
  readonly dictionary: Dictionary;
  readonly #keyboard: Keyboard;

  constructor(
    settings: Settings,
    keyboard: Keyboard,
    model: PhoneticModel,
    wordList: WordList,
  ) {
    super(settings, keyboard, model);
    this.#keyboard = keyboard;
    this.dictionary = new Dictionary(
      filterWordList(wordList, this.codePoints).filter(
        (word) => word.length > 2,
      ),
    );
  }

  override get letters() {
    return this.model.letters;
  }

  override update(keyStatsMap: KeyStatsMap) {
    if (this.settings.get(lessonProps.guided.adaptive)) {
      return this.#updateAdaptive(keyStatsMap);
    }
    const alphabetSize = this.settings.get(lessonProps.guided.alphabetSize);
    const recoverKeys = this.settings.get(lessonProps.guided.recoverKeys);

    const letters = this.#getLetters();

    const minSize = 6;
    const maxSize =
      minSize + Math.round((letters.length - minSize) * alphabetSize);

    const target = new Target(this.settings);

    const lessonKeys = new LessonKeys(
      letters.map((letter) => LessonKey.from(keyStatsMap.get(letter), target)),
    );

    for (const lessonKey of lessonKeys) {
      const includedKeys = lessonKeys.findIncludedKeys();

      if (includedKeys.length < minSize) {
        // Meet the minimal required alphabet size.
        lessonKeys.include(lessonKey.letter);
        continue;
      }

      if (includedKeys.length < maxSize) {
        // Meet the maximal required alphabet size.
        lessonKeys.force(lessonKey.letter);
        continue;
      }

      if ((lessonKey.bestConfidence ?? 0) >= 1) {
        // Must include all confident keys.
        lessonKeys.include(lessonKey.letter);
        continue;
      }

      if (recoverKeys) {
        if (includedKeys.every((key) => (key.confidence ?? 0) >= 1)) {
          // Include a new key only when all the previous keys
          // are now above the target speed.
          lessonKeys.include(lessonKey.letter);
          continue;
        }
      } else {
        if (includedKeys.every((key) => (key.bestConfidence ?? 0) >= 1)) {
          // Include a new key only when all the previous keys
          // were once above the target speed.
          lessonKeys.include(lessonKey.letter);
          continue;
        }
      }
    }

    // Find the least confident of all included keys and focus on it.
    const confidenceOf = (key: LessonKey): number => {
      return recoverKeys ? (key.confidence ?? 0) : (key.bestConfidence ?? 0);
    };
    const weakestKeys = lessonKeys
      .findIncludedKeys()
      .filter((key) => confidenceOf(key) < 1)
      .sort((a, b) => confidenceOf(a) - confidenceOf(b));
    if (weakestKeys.length > 0) {
      lessonKeys.focus(weakestKeys[0].letter);
    }

    return lessonKeys;
  }

  override generate(lessonKeys: LessonKeys, rng: RNGStream) {
    const filter = new Filter(
      lessonKeys.findIncludedKeys(),
      lessonKeys.findFocusedKey(),
    );
    const wordGenerator =
      (this.settings.get(lessonProps.guided.adaptive) &&
        this.settings.get(lessonProps.guided.naturalWords) &&
        this.#makeAdaptiveWordGenerator(lessonKeys, rng)) ||
      this.#makeWordGenerator(filter, rng);
    const words = mangledWords(
      uniqueWords(wordGenerator),
      this.model.language,
      Letter.restrict(Letter.punctuators, this.codePoints),
      {
        withCapitals: this.settings.get(lessonProps.capitals),
        withPunctuators: this.settings.get(lessonProps.punctuators),
      },
      rng,
    );
    return generateFragment(this.settings, words, {
      repeatWords: this.settings.get(lessonProps.repeatWords),
    });
  }

  /**
   * Same alphabet growth as the original algorithm, but:
   * - confidence includes accuracy, not only speed,
   * - the focused key is the one with the largest frequency weighted need,
   *   using current (not best ever) performance, so regressed keys come back,
   * - a slow key cannot block new letters forever: once the newest letter
   *   was practiced for `stallLessons` lessons and the alphabet is good
   *   on average, the next letter is added.
   */
  #updateAdaptive(keyStatsMap: KeyStatsMap) {
    const alphabetSize = this.settings.get(lessonProps.guided.alphabetSize);
    const recoverKeys = this.settings.get(lessonProps.guided.recoverKeys);
    const stallLessons = this.settings.get(lessonProps.guided.stallLessons);

    const letters = this.#getLetters();

    const minSize = 6;
    const maxSize =
      minSize + Math.round((letters.length - minSize) * alphabetSize);

    const target = new Target(this.settings);

    const lessonKeys = new LessonKeys(
      letters.map((letter) => LessonKey.from(keyStatsMap.get(letter), target)),
    );

    let newest: LessonKey | null = null;
    for (const lessonKey of lessonKeys) {
      const includedKeys = lessonKeys.findIncludedKeys();
      const include = (force = false) => {
        if (force) {
          lessonKeys.force(lessonKey.letter);
        } else {
          lessonKeys.include(lessonKey.letter);
        }
        newest = lessonKey;
      };

      if (includedKeys.length < minSize) {
        include();
        continue;
      }

      if (includedKeys.length < maxSize) {
        include(true);
        continue;
      }

      if ((lessonKey.bestConfidence ?? 0) >= 1) {
        include();
        continue;
      }

      const confidenceOf = (key: LessonKey): number =>
        (recoverKeys ? key.confidence : key.bestConfidence) ?? 0;
      if (includedKeys.every((key) => confidenceOf(key) >= 1)) {
        include();
        continue;
      }

      if (
        stallLessons > 0 &&
        newest != null &&
        (newest as LessonKey).samples.length >= stallLessons &&
        meanConfidence(includedKeys) >= adaptive.stallConfidence
      ) {
        include();
        continue;
      }
    }

    this.targetSpeed = target.targetSpeed;
    const autoSpeed = this.#autoTargetSpeed(lessonKeys, target.targetSpeed);
    if (autoSpeed != null) {
      // The whole alphabet is open, keep the target just above the user.
      const autoTarget = new Target(this.settings, autoSpeed);
      this.targetSpeed = autoSpeed;
      const raised = new LessonKeys(
        letters.map((letter) =>
          LessonKey.from(keyStatsMap.get(letter), autoTarget).asIncluded(),
        ),
      );
      this.#focusWeakest(raised);
      return raised;
    }

    this.#focusWeakest(lessonKeys);
    return lessonKeys;
  }

  /**
   * The current target speed of the adaptive mode: the configured one while
   * letters are being unlocked, then the median of the best key speeds plus
   * a margin, so the target grows together with the user.
   */
  targetSpeed: number = 0;

  #autoTargetSpeed(lessonKeys: LessonKeys, configured: number): number | null {
    if (
      !this.settings.get(lessonProps.guided.autoTarget) ||
      lessonKeys.findExcludedKeys().length > 0
    ) {
      return null;
    }
    const speeds = lessonKeys
      .findIncludedKeys()
      .filter(({ bestTimeToType }) => bestTimeToType != null)
      .map(({ bestTimeToType }) => timeToSpeed(bestTimeToType!))
      .sort((a, b) => a - b);
    if (speeds.length === 0) {
      return null;
    }
    const median = speeds[Math.floor(speeds.length / 2)];
    const auto = Math.round((median * adaptive.targetMargin) / 5) * 5;
    return auto > configured ? auto : null;
  }

  #focusWeakest(lessonKeys: LessonKeys): void {
    const includedKeys = lessonKeys.findIncludedKeys();
    const maxFrequency = Math.max(
      ...includedKeys.map(({ letter }) => letter.f),
    );
    let focused: LessonKey | null = null;
    let focusedNeed = 0;
    for (const key of includedKeys) {
      const need = needOf(key, maxFrequency);
      if (need > focusedNeed) {
        focused = key;
        focusedNeed = need;
      }
    }
    if (focused != null) {
      lessonKeys.focus(focused.letter);
    }
  }

  /**
   * Picks real words with all letters from the current alphabet,
   * weighted by how many weak letters they contain and by word frequency.
   * Unlike the original generator it does not require the focused letter
   * in every word, so the text stays natural while weak keys still dominate.
   */
  #makeAdaptiveWordGenerator(
    lessonKeys: LessonKeys,
    rng: RNGStream,
  ): WordGenerator | null {
    const includedKeys = lessonKeys.findIncludedKeys();
    const focusedKey = lessonKeys.findFocusedKey();
    const words = this.dictionary.find(new Filter(includedKeys, null));
    if (words.length < 15) {
      return null;
    }
    const maxFrequency = Math.max(
      ...includedKeys.map(({ letter }) => letter.f),
    );
    const needs = new Map<number, number>();
    for (const key of includedKeys) {
      needs.set(key.letter.codePoint, needOf(key, maxFrequency));
    }
    const focusedCodePoint = focusedKey?.letter.codePoint ?? null;
    const pairNeed = this.#makeBigramNeed(needs);
    const confusions = this.#confusionNeeds(needs);
    const weighted = words.slice(0, 3000).map((word, rank) => {
      const codePoints = [...word].map((c) => c.codePointAt(0)!);
      let need = 0;
      let focused = false;
      for (const codePoint of new Set(codePoints)) {
        need += needs.get(codePoint) ?? 0;
        if (codePoint === focusedCodePoint) {
          focused = true;
        }
      }
      let need2 = 0;
      for (let i = 1; i < codePoints.length; i++) {
        need2 += pairNeed(codePoints[i - 1], codePoints[i]);
      }
      const unique = new Set(codePoints);
      for (const { expected, actual, weight } of confusions) {
        if (unique.has(expected)) {
          // Both letters in one word train telling them apart.
          need2 += unique.has(actual) ? weight : weight / 2;
        }
      }
      // Normalize by length, otherwise long words win just by having
      // more letters, while real text is mostly short words.
      const { length } = codePoints;
      need = need / Math.sqrt(length) + need2 / Math.sqrt(length - 1 || 1);
      const frequency = 1 / Math.sqrt(1 + rank / 50);
      const shortness = length <= 8 ? 1 : 8 / length;
      const weight = frequency * shortness * (0.2 + need) * (focused ? 3 : 1);
      return { word, weight };
    });
    return () =>
      weightedRandomSample(weighted, ({ weight }) => weight, rng).word;
  }

  /** Need of a letter transition, see `bigramNeed`, cached per lesson. */
  #makeBigramNeed(
    needs: ReadonlyMap<number, number>,
  ): (a: number, b: number) => number {
    const targetTime = speedToTime(
      this.targetSpeed || this.settings.get(lessonProps.targetSpeed),
    );
    const stats = bigramStore.current;
    const cache = new Map<number, number>();
    return (a, b) => {
      const key = a * 0x10000 + b;
      let need = cache.get(key);
      if (need == null) {
        need = bigramNeed(
          stats.get(a, b),
          geometryDifficulty(this.#keyboard, a, b),
          (needs.get(a) ?? 0) + (needs.get(b) ?? 0),
          targetTime,
        );
        cache.set(key, need);
      }
      return need;
    };
  }

  /**
   * Frequent wrong keys among the current letters, with weights in [0, 1]
   * relative to the worst confusion.
   */
  #confusionNeeds(needs: ReadonlyMap<number, number>) {
    const top = confusionStore.current
      .top(30)
      .filter(({ expected, count }) => needs.has(expected) && count >= 1);
    const max = Math.max(1, ...top.map(({ count }) => count));
    return top.map(({ expected, actual, count }) => ({
      expected,
      actual,
      weight: count / max,
    }));
  }

  /** The wrong keys typed most often instead of the current letters. */
  weakConfusions(lessonKeys: LessonKeys, limit = 8): [string, string][] {
    const included = new Set(
      lessonKeys.findIncludedKeys().map(({ letter }) => letter.codePoint),
    );
    return confusionStore.current
      .top(100)
      .filter(({ expected, count }) => included.has(expected) && count >= 1)
      .slice(0, limit)
      .map(({ expected, actual }) => [
        String.fromCodePoint(expected),
        String.fromCodePoint(actual),
      ]);
  }

  /**
   * The transitions which need practice most among the current letters,
   * the most frequent ones first when needs are equal.
   */
  weakBigrams(lessonKeys: LessonKeys, limit = 12): [string, number][] {
    const includedKeys = lessonKeys.findIncludedKeys();
    const maxFrequency = Math.max(
      ...includedKeys.map(({ letter }) => letter.f),
    );
    const needs = new Map<number, number>();
    for (const key of includedKeys) {
      needs.set(key.letter.codePoint, needOf(key, maxFrequency));
    }
    const pairNeed = this.#makeBigramNeed(needs);
    const result: [string, number][] = [];
    for (const [a, b, f] of this.model.ngram2()) {
      if (needs.has(a) && needs.has(b) && f > 0) {
        const need = pairNeed(a, b) * Math.sqrt(f);
        if (need > 0) {
          result.push([String.fromCodePoint(a, b), need]);
        }
      }
    }
    return result.sort(([, x], [, y]) => y - x).slice(0, limit);
  }

  #getLetters() {
    const letters = this.#reachableLetters();
    const { codePoints } = this;
    if (this.settings.get(lessonProps.guided.keyboardOrder)) {
      return Letter.weightedFrequencyOrder(letters, ({ codePoint }) =>
        codePoints.weight(codePoint),
      );
    } else {
      return Letter.frequencyOrder(letters);
    }
  }

  /**
   * On split keyboards some letters (like Russian ё and ъ on Corne) live
   * on a held layer. They are trained by the symbols lesson, not here.
   */
  #reachableLetters() {
    const { letters } = this.model;
    if (
      !this.settings.get(lessonProps.guided.skipLayerLetters) ||
      this.#keyboard.getShape("LayerNum") == null
    ) {
      return letters;
    }
    return letters.filter(({ codePoint }) => {
      const combo = this.#keyboard.getCombo(codePoint);
      const shape = combo != null ? this.#keyboard.getShape(combo.id) : null;
      return shape?.row !== "digit";
    });
  }

  #makeWordGenerator(filter: Filter, rng: RNGStream) {
    const pseudoWords = phoneticWords(this.model, filter, rng);
    if (this.settings.get(lessonProps.guided.naturalWords)) {
      const words = this.dictionary.find(filter).slice(0, 1000);
      while (words.length < 15) {
        const word = pseudoWords();
        if (word != null) {
          words.push(word);
        } else {
          break;
        }
      }
      if (words.length === 0) {
        words.push("?");
      }
      return randomWords(words, rng);
    }
    return pseudoWords;
  }
}
