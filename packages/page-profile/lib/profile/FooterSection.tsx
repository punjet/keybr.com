import { useResults } from "@keybr/result";
import { Button, Field, FieldList, Icon } from "@keybr/widget";
import { mdiDeleteForever, mdiDownload, mdiUpload } from "@mdi/js";
import { useIntl } from "react-intl";
import {
  clearAdaptiveData,
  formatDownloadedData,
  mergeAdaptiveData,
  newResultsOnly,
  parseDownloadedData,
} from "./importdata.ts";

export function FooterSection() {
  const { formatMessage } = useIntl();
  const { handleDownloadData, handleUploadData, handleResetData } =
    useCommands();

  return (
    <FieldList>
      <Field>
        <Button
          size={16}
          icon={<Icon shape={mdiDownload} />}
          label={formatMessage({
            id: "t_Download_data",
            defaultMessage: "Download data",
          })}
          title={formatMessage({
            id: "profile.download.description",
            defaultMessage: "Download all your typing data in JSON format.",
          })}
          onClick={() => {
            handleDownloadData();
          }}
        />
      </Field>
      <Field>
        <Button
          size={16}
          icon={<Icon shape={mdiUpload} />}
          label={formatMessage({
            id: "t_Upload_data",
            defaultMessage: "Upload data",
          })}
          title={formatMessage({
            id: "profile.upload.description",
            defaultMessage:
              "Import typing data previously downloaded in JSON format.",
          })}
          onClick={() => {
            handleUploadData();
          }}
        />
      </Field>
      <Field.Filler />
      <Field>
        <Button
          size={16}
          icon={<Icon shape={mdiDeleteForever} />}
          label={formatMessage({
            id: "t_Reset_statistics",
            defaultMessage: "Reset statistics",
          })}
          title={formatMessage({
            id: "profile.reset.description",
            defaultMessage:
              "Permanently delete all of your typing data and reset statistics.",
          })}
          onClick={() => {
            handleResetData();
          }}
        />
      </Field>
    </FieldList>
  );
}

function useCommands() {
  const { formatMessage } = useIntl();
  const { results, appendResults, clearResults } = useResults();
  return {
    handleDownloadData: () => {
      const json = formatDownloadedData(results, window.localStorage);
      const blob = new Blob([json], { type: "application/json" });
      const now = new Date();
      const date = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-");
      download(blob, `typing-data-${date}.json`).catch((err) => {
        window.alert(`Cannot save data: ${String(err)}`);
      });
    },
    handleUploadData: () => {
      upload(async (file) => {
        try {
          const { results: imported, adaptive } = parseDownloadedData(
            JSON.parse(await file.text()),
          );
          const fresh = newResultsOnly(results, imported);
          if (fresh.length > 0) {
            appendResults(fresh);
          }
          const restored = mergeAdaptiveData(window.localStorage, adaptive);
          window.alert(
            `Imported ${fresh.length} new results ` +
              `(${imported.length - fresh.length} already present), ` +
              `restored ${restored} bigram/confusion tables.`,
          );
        } catch (err) {
          window.alert(`Cannot import data: ${String(err)}`);
        }
      });
    },
    handleResetData: () => {
      const message = formatMessage({
        id: "profile.reset.message",
        defaultMessage:
          "Are you sure you want to delete all data and reset your profile? " +
          "This operation is permanent and cannot be undone!",
      });
      if (window.confirm(message)) {
        clearResults();
        clearAdaptiveData(window.localStorage);
      }
    },
  };
}

async function download(blob: Blob, name: string): Promise<void> {
  // Prefer the native save dialog: with a bare blob link some browsers
  // ignore the file name and save the data under a random name.
  const picker = (
    window as {
      showSaveFilePicker?: (options: unknown) => Promise<{
        createWritable: () => Promise<{
          write: (data: Blob) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    }
  ).showSaveFilePicker;
  if (picker != null) {
    let handle;
    try {
      handle = await picker({
        suggestedName: name,
        types: [
          {
            description: "JSON",
            accept: { "application/json": [".json"] },
          },
        ],
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return; // The user cancelled the dialog.
      }
      throw err;
    }
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }
  const file = new File([blob], name, { type: blob.type });
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // Keep the link and the URL alive until the browser picks up the name.
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

function upload(callback: (file: File) => void) {
  const input = document.createElement("input");
  input.setAttribute("type", "file");
  input.setAttribute("accept", "application/json,.json");
  input.setAttribute("hidden", "");
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    document.body.removeChild(input);
    if (file != null) {
      callback(file);
    }
  });
  document.body.appendChild(input);
  input.click();
}
