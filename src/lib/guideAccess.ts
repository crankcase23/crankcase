import type { RepairGuide } from "@/types/vehicle";

// Access rules for guides, kept in one pure place so "preview" can never leak into "paid".
//
//   readable    - may a customer open and read this guide?  Always yes today: nothing is gated.
//   isPreview   - uncertified, incomplete content (RepairGuide.preview).
//   isSellable  - may this guide be part of a paid Get the Keys unlock, or be shown with a purchase prompt?
//                 Only a premium guide that is NOT a preview. A preview guide is never sold, even if its tier is "premium".
//
// There is no unlock backend yet (see keysPricing.ts). When one exists it must call isSellable(), not read `tier`.

type Access = Pick<RepairGuide, "tier" | "preview">;

export const isPreview = (g: Access): boolean => g.preview === true;
export const isSellable = (g: Access): boolean => g.tier === "premium" && !isPreview(g);
export const readable = (): true => true;
