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
              defaultMessage: "Adaptive algorithm (speed + accuracy)",
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
              defaultMessage:
                "Skip letters on held layers (like ё, ъ on a Corne)",
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
              defaultMessage: "Raise the target once all letters are unlocked",
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
            defaultMessage="Unlock the next letter after a stall of lessons:"
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
            defaultMessage="Key confidence takes both speed and errors into account. The focused key is chosen by the current (not the best ever) performance weighted by letter frequency, so frequent letters that regressed come back into practice. Words come from the dictionary weighted by weak letters, without requiring the focused letter in every word. Weak bigrams and frequent mistypes (which key you press instead of the right one) are trained too. If the newest letter was practiced for the given number of lessons and the alphabet is good on average, the next letter is unlocked (0 disables this). Once all letters are unlocked, the target becomes the median of your best key speeds +5% and grows with you (never below the configured one)."
          />
        </Description>
      </Explainer>
    </>
  );
}
