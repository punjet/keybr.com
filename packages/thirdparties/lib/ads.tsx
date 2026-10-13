import { memo, type ReactNode } from "react";

// Personal fork: ads are disabled everywhere, so neither the ad scripts
// nor the placeholder boxes are ever rendered.

export const slot1 = "keybr_728x90_970x90_ATF";
export const slot2 = "keybr_160x600_Left";

export type AdDetails = {
  readonly id: string;
  readonly width: number;
  readonly height: number;
};

export const inventory: Record<string, AdDetails> = {
  BANNER_970X90_1: { id: slot1, width: 970, height: 90 },
  BANNER_160X600_1: { id: slot2, width: 160, height: 600 },
};

export function SetupAds(_props: { readonly children: ReactNode }): ReactNode {
  return null;
}

export const AdBanner = memo(function AdBanner(_props: {
  readonly name: "BANNER_160X600_1" | "BANNER_970X90_1";
}): ReactNode {
  return null;
});
