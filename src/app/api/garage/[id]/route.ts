import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { removeGarageEntry } from "@/lib/garageEntries";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
    await removeGarageEntry(userId, id);
    return NextResponse.json({ ok: true });
}
