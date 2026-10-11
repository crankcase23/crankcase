import {
  adminTestGuides as chargerGuides,
  type AdminTestGuide,
} from "./charger-2016-sxt-multi-job";
import { bmwDraftGuides } from "./bmw-2010-328i-drafts";

// Single registry for every unpublished, admin-only guide. Nothing outside /admin may import this directory: that is
// what keeps these guides out of the customer catalog (see the gate comments on the admin test route).
export type { AdminTestGuide };

const ALL: AdminTestGuide[] = [...chargerGuides, ...bmwDraftGuides];

export function listAdminTestGuides(): AdminTestGuide[] {
  return ALL;
}

export function findAdminTestGuide(slug: string): AdminTestGuide | undefined {
  return ALL.find((g) => g.slug === slug);
}
