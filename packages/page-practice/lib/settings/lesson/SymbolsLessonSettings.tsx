import { lessonProps, type SymbolsLesson } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import {
  Description,
  Explainer,
  Field,
  FieldList,
  FieldSet,
  Range,
  Value,
} from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { LessonLengthProp } from "./LessonLengthProp.tsx";
import { TargetSpeedProp } from "./TargetSpeedProp.tsx";

export function SymbolsLessonSettings({
  lesson,
}: {
  readonly lesson: SymbolsLesson;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <Explainer>
        <Description>
          <FormattedMessage
            id="lessonType.symbols.description"
            defaultMessage="Цифры и знаки вперемешку со словами: тренирует переключение на слой NUM и обратно. Чаще всего попадаются самые медленные и ошибочные символы. Символов в наборе: {count}."
            values={{ count: lesson.letters.length }}
          />
        </Description>
      </Explainer>
      <FieldSet
        legend={formatMessage({
          id: "t_Lesson_options",
          defaultMessage: "Lesson options",
        })}
      >
        <TargetSpeedProp />
        <FieldList>
          <Field>
            <FormattedMessage
              id="t_Words_between_symbols:"
              defaultMessage="Слов между символами:"
            />
          </Field>
          <Field>
            <Range
              min={lessonProps.symbols.wordsBetween.min}
              max={lessonProps.symbols.wordsBetween.max}
              step={1}
              value={settings.get(lessonProps.symbols.wordsBetween)}
              onChange={(value) => {
                updateSettings(
                  settings.set(lessonProps.symbols.wordsBetween, value),
                );
              }}
            />
          </Field>
          <Field>
            <Value value={settings.get(lessonProps.symbols.wordsBetween)} />
          </Field>
        </FieldList>
        <LessonLengthProp />
      </FieldSet>
    </>
  );
}
