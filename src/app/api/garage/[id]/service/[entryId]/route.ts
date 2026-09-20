import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { resolveGarageEntryId } from "@/lib/garageEntries";
import { deleteServiceEntry } from "@/lib/serviceEntriesDb";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id, entryId } = await params;

  // Resolve the vehicle in the URL to THIS user's garage entry first, and
  // authorize the delete against that. resolveGarageEntryId only returns an
  // entry belonging to the signed-in user, so proving ownership of the
  // vehicle is what proves the right to delete a row from its log -- the
  // service row's own user_id is no longer load-bearing here, because it can
  // legitimately be null once the account that logged it is gone.
  //
  // `create: false` matters: a DELETE must never conjure a garage entry.
  const garageEntryId = await resolveGarageEntryId(userId, id, { create: false });
  if (!garageEntryId) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await deleteServiceEntry(garageEntryId, entryId);
  return NextResponse.json({ ok: true });
}
