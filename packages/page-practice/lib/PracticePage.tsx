import { ViewSwitch } from "@keybr/widget";
import { views } from "./views.tsx";

// Personal fork: the default layout is always Russian on the Eyelash Corne
// (see keyboardProps), regardless of the browser locale.

export function PracticePage() {
  return <ViewSwitch views={views} />;
}
