import {
  Geometry,
  getZmkConfig,
  getZmkGeometry,
  KeyboardOptions,
  setZmkConfig,
} from "@keybr/keyboard";
import { useSettings } from "@keybr/settings";
import {
  Button,
  Description,
  Explainer,
  Field,
  FieldList,
  Icon,
} from "@keybr/widget";
import { mdiDeleteForever, mdiUpload } from "@mdi/js";
import { type ReactNode, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

/**
 * Upload of a ZMK keymap (and optionally its physical layout JSON), which
 * becomes the "ZMK config" geometry with the layers of the config.
 */
export function ZmkConfigProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  const [error, setError] = useState<string | null>(null);
  const [, setRevision] = useState(0);
  const geometry = getZmkGeometry();
  const config = getZmkConfig();
  const options = KeyboardOptions.from(settings);

  const handleUpload = () => {
    pickFiles(async (files) => {
      try {
        let keymap: string | null = null;
        let physical: string | null = null;
        let name = "ZMK";
        for (const file of files) {
          const text = await file.text();
          // A physical layout: ZMK Studio / QMK JSON or the board devicetree
          // (`<board>-layouts.dtsi`) with a zmk,physical-layout node.
          if (
            file.name.endsWith(".json") ||
            text.includes("zmk,physical-layout")
          ) {
            physical = text;
          } else {
            keymap = text;
            name = file.name.replace(/\.[^.]*$/, "");
          }
        }
        if (keymap == null) {
          throw new Error(
            formatMessage({
              id: "settings.zmkConfig.noKeymap",
              defaultMessage:
                "Choose a keymap file (.keymap) and optionally a physical layout file (.json)",
            }),
          );
        }
        setZmkConfig({ name, keymap, physical });
        setError(null);
        setRevision((r) => r + 1);
        updateSettings(options.withGeometry(Geometry.ZMK).save(settings));
      } catch (err) {
        setError(String((err as Error).message ?? err));
      }
    });
  };

  const handleRemove = () => {
    setZmkConfig(null);
    setRevision((r) => r + 1);
    updateSettings(
      KeyboardOptions.default()
        .withLanguage(options.language)
        .withLayout(options.layout)
        .save(settings),
    );
  };

  return (
    <>
      <FieldList>
        <Field>
          <FormattedMessage id="t_Zmk_config:" defaultMessage="ZMK config:" />
        </Field>
        <Field>
          {geometry != null && config != null ? (
            <span>
              {formatMessage(
                {
                  id: "settings.zmkConfig.summary",
                  defaultMessage:
                    "{name}: {keys} keys{skipped, plural, =0 {} other {, # skipped (joystick, encoders)}}",
                },
                {
                  name: config.name,
                  keys: geometry.keys,
                  skipped: geometry.skipped,
                },
              )}
              {geometry.layers.map(({ name, activator, keys }) => (
                <span key={name}>
                  {", "}
                  {formatMessage(
                    {
                      id: "settings.zmkConfig.layer",
                      defaultMessage:
                        "layer {name}: {keys} symbols, hold {activator}",
                    },
                    { name, keys, activator },
                  )}
                </span>
              ))}
              {geometry.guessed &&
                " " +
                  formatMessage({
                    id: "settings.zmkConfig.noPhysical",
                    defaultMessage:
                      "(positions guessed from the keymap: add the physical layout file for exact positions)",
                  })}
            </span>
          ) : (
            <span>—</span>
          )}
        </Field>
      </FieldList>
      <FieldList>
        <Field>
          <Button
            size={16}
            icon={<Icon shape={mdiUpload} />}
            label={formatMessage({
              id: "t_Upload_zmk_config",
              defaultMessage: "Upload keymap (.keymap)",
            })}
            onClick={handleUpload}
          />
        </Field>
        {geometry != null && (
          <Field>
            <Button
              size={16}
              icon={<Icon shape={mdiDeleteForever} />}
              label={formatMessage({
                id: "t_Remove_zmk_config",
                defaultMessage: "Remove",
              })}
              onClick={handleRemove}
            />
          </Field>
        )}
      </FieldList>
      {error != null && (
        <Explainer>
          <Description>
            {formatMessage(
              {
                id: "settings.zmkConfig.error",
                defaultMessage: "Cannot load the config: {error}",
              },
              { error },
            )}
          </Description>
        </Explainer>
      )}
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.zmkConfig.description"
            defaultMessage="Choose the keymap file (.keymap) of your ZMK config, ideally together with the physical layout file: the devicetree file of the board (its name ends with -layouts.dtsi) or a JSON file from ZMK Studio or QMK (info.json). Then keys get their real positions. Joysticks and encoders between the halves are skipped. A “ZMK config” geometry appears for every layout: the base layer gives the keys, and characters from held layers are shown on the same keys in symbol, number and code lessons, with a hint which key to hold. The config is stored in this browser."
          />
        </Description>
      </Explainer>
    </>
  );
}

function pickFiles(callback: (files: File[]) => void) {
  const input = document.createElement("input");
  input.setAttribute("type", "file");
  input.setAttribute("accept", ".keymap,.dtsi,.overlay,.json,text/plain");
  input.setAttribute("multiple", "");
  input.style.display = "none";
  input.addEventListener("change", () => {
    const files = [...(input.files ?? [])];
    document.body.removeChild(input);
    if (files.length > 0) {
      callback(files);
    }
  });
  document.body.appendChild(input);
  input.click();
}
