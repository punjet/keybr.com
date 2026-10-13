import { lessonProps } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import {
  CheckBox,
  Description,
  Explainer,
  Field,
  FieldList,
  Range,
  Value,
} from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export function AdaptiveProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  const adaptive = settings.get(lessonProps.guided.adaptive);
  return (
    <>
      <FieldList>
        <Field>
          <CheckBox
            label={formatMessage({
              id: "t_Adaptive_algorithm",
              defaultMessage: "Адаптивный алгоритм (скорость + точность)",
            })}
            checked={adaptive}
            onChange={(value) => {
              updateSettings(settings.set(lessonProps.guided.adaptive, value));
            }}
          />
        </Field>
        <Field>
          <CheckBox
            label={formatMessage({
              id: "t_Skip_layer_letters",
              defaultMessage: "Без букв со слоя (ё, ъ на Corne)",
            })}
            checked={settings.get(lessonProps.guided.skipLayerLetters)}
            onChange={(value) => {
              updateSettings(
                settings.set(lessonProps.guided.skipLayerLetters, value),
              );
            }}
          />
        </Field>
        <Field>
          <CheckBox
            label={formatMessage({
              id: "t_Auto_target_speed",
              defaultMessage: "Растущая цель после открытия всех букв",
            })}
            checked={settings.get(lessonProps.guided.autoTarget)}
            disabled={!adaptive}
            onChange={(value) => {
              updateSettings(
                settings.set(lessonProps.guided.autoTarget, value),
              );
            }}
          />
        </Field>
      </FieldList>
      <FieldList>
        <Field>
          <FormattedMessage
            id="t_Stall_lessons:"
            defaultMessage="Открыть букву при застое через уроков:"
          />
        </Field>
        <Field>
          <Range
            min={lessonProps.guided.stallLessons.min}
            max={lessonProps.guided.stallLessons.max}
            step={5}
            value={settings.get(lessonProps.guided.stallLessons)}
            disabled={!adaptive}
            onChange={(value) => {
              updateSettings(
                settings.set(lessonProps.guided.stallLessons, value),
              );
            }}
          />
        </Field>
        <Field>
          <Value value={settings.get(lessonProps.guided.stallLessons)} />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.adaptive.description"
            defaultMessage="Уверенность по клавише учитывает и скорость, и ошибки. Фокус выбирается по текущему (а не лучшему) результату с поправкой на частоту буквы, поэтому просевшие частые буквы возвращаются в тренировку. Слова берутся из словаря с весом по слабым буквам, без требования фокусной буквы в каждом слове. Если новая буква тренировалась заданное число уроков, а алфавит в среднем на уровне, открывается следующая буква (0 — выключено). Учитываются слабые биграммы и частые промахи (какую клавишу нажимаешь вместо нужной). Когда открыты все буквы, цель становится медианой твоих лучших скоростей по клавишам +5% и растёт вместе с тобой (не ниже заданной)."
          />
        </Description>
      </Explainer>
    </>
  );
}
