import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { deleteServiceEntry } from "@/lib/serviceEntriesDb";

export async function DELETE(
    _request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> },
  ) {
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { entryId } = await params;
    await deleteServiceEntry(userId, entryId);
    return NextResponse.json({ ok: true });
}
