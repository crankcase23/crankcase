import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/rbac";
import { recordError } from "@/lib/errors";

// ---------------------------------------------------------------------------
// "Ask Crankcase" command endpoint.
//
// READ THIS BEFORE EXTENDING IT.
//
// There is no AI model behind this. It does not generate answers, and it must
// never appear to. What it does is deterministic intent matching: a small
// registry of patterns the admin genuinely supports, each mapping to a real
// screen with real filters. Anything that doesn't match returns
// status:"unavailable" with a plain statement that natural-language answering
// isn't connected -- no guess, no invented number, no plausible-sounding
// sentence.
//
// The architecture is deliberately the shape an LLM handler would slot into:
//
//   query -> classify(query) -> Intent { status, message, href }  -> client
//
// To connect a model later, keep this contract and add a fallback branch
// where UNAVAILABLE is returned today: send the query plus a tool/function
// schema describing the admin's own query functions (getCommandCenterMetrics,
// listGuideRecords, the user/vehicle search), let the model pick and fill
// one, run it server-side, and return the result as status:"answered". The
// UI already renders that status. Nothing on the client needs to change.
//
// Authorization: this route re-checks admin access itself. It does not trust
// the fact that the UI rendering it was only shown to admins.
// ---------------------------------------------------------------------------

export interface CommandResponse {
  status: "routed" | "answered" | "unavailable" | "error";
  message: string;
  href?: string;
  detail?: string;
}

interface Intent {
  /** All of these must appear somewhere in the normalised query. */
  requires: string[][];
  /** Permission needed to follow this intent. */
  permission: Parameters<typeof requireAdmin>[0];
  href: string;
  message: string;
}

// Each `requires` entry is an AND of ORs: [["user","account"],["new","recent"]]
// matches a query containing (user OR account) AND (new OR recent).
const INTENTS: Intent[] = [
  {
    requires: [["user", "account", "signup", "sign-up"], ["new", "recent", "latest", "this week", "today"]],
    permission: "users.view",
    href: "/admin/users?sort=created&dir=desc&period=7d",
    message: "Showing the newest accounts.",
  },
  {
    requires: [["user", "account"], ["disabled", "suspended", "banned"]],
    permission: "users.view",
    href: "/admin/users?status=disabled",
    message: "Showing disabled accounts.",
  },
  {
    requires: [["user", "account", "customer"]],
    permission: "users.view",
    href: "/admin/users",
    message: "Opening Users.",
  },
  {
    requires: [["vehicle", "car", "garage"], ["add", "added", "new", "month", "recent"]],
    permission: "vehicles.view",
    href: "/admin/vehicles?sort=created&dir=desc&period=30d",
    message: "Showing recently added vehicles.",
  },
  {
    requires: [["vehicle", "car"], ["custom", "missing", "demand", "backlog", "not covered"]],
    permission: "vehicles.view",
    href: "/admin/vehicles?kind=custom",
    message: "Showing user vehicles with no curated data — your demand backlog.",
  },
  {
    requires: [["vehicle", "car", "make", "model"]],
    permission: "vehicles.view",
    href: "/admin/vehicles",
    message: "Opening Vehicles.",
  },
  {
    requires: [["guide"], ["torque", "missing", "incomplete", "missing torque"]],
    permission: "guides.view",
    href: "/admin/guides?filter=incomplete",
    message: "Showing guides that fail the publish checklist, including missing torque specifications.",
  },
  {
    requires: [["guide"], ["view", "viewed", "popular", "most"]],
    permission: "guides.view",
    href: "/admin/guides?sort=views&dir=desc",
    message: "Showing guides ranked by views.",
  },
  {
    requires: [["guide", "repair", "procedure"]],
    permission: "guides.view",
    href: "/admin/guides",
    message: "Opening Service Guides.",
  },
  {
    requires: [["payment", "revenue", "sales", "money", "mrr", "churn", "subscription"], ["fail", "failed", "declined"]],
    permission: "revenue.view",
    href: "/admin/revenue#failed",
    message: "Showing failed payments.",
  },
  {
    requires: [["revenue", "payment", "sales", "money", "mrr", "churn", "subscription", "purchase"]],
    permission: "revenue.view",
    href: "/admin/revenue",
    message: "Opening Revenue.",
  },
  {
    requires: [["error", "crash", "bug", "glitch", "exception"]],
    permission: "system.view",
    href: "/admin/system#errors",
    message: "Showing the error log.",
  },
  {
    requires: [["health", "status", "uptime", "system", "database"]],
    permission: "system.view",
    href: "/admin/system",
    message: "Opening System Health.",
  },
  {
    requires: [["change", "changed", "happened", "activity", "audit", "who", "log"]],
    permission: "audit.view",
    href: "/admin/security",
    message: "Showing the administrative audit log.",
  },
  {
    requires: [["content", "article", "faq", "announcement"]],
    permission: "content.view",
    href: "/admin/content",
    message: "Opening Content.",
  },
  {
    requires: [["funnel", "conversion", "drop", "analytics", "traffic"]],
    permission: "analytics.view",
    href: "/admin/analytics",
    message: "Opening Analytics.",
  },
];

function classify(query: string): Intent | null {
  const q = query.toLowerCase();
  for (const intent of INTENTS) {
    const matches = intent.requires.every((group) => group.some((term) => q.includes(term)));
    if (matches) return intent;
  }
  return null;
}

export async function POST(request: Request) {
  // Re-verify authorization server-side; never rely on the caller.
  const ctx = await requireAdmin("command.view");
  if (!ctx) {
    return NextResponse.json<CommandResponse>(
      { status: "error", message: "Not authorized." },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as { query?: unknown };
    const query = typeof body.query === "string" ? body.query.trim() : "";

    if (!query) {
      return NextResponse.json<CommandResponse>({ status: "error", message: "Ask me something first." });
    }
    if (query.length > 500) {
      return NextResponse.json<CommandResponse>({ status: "error", message: "That query is too long." });
    }

    const intent = classify(query);

    if (!intent) {
      return NextResponse.json<CommandResponse>({
        status: "unavailable",
        message: "I can't answer that yet — natural-language answering isn't connected.",
        detail:
          "Right now this bar recognises questions about users, vehicles, guides, revenue, content, analytics, errors and the audit log, and takes you to the right screen. Anything beyond that needs the AI backend, which isn't wired up.",
      });
    }

    // The matched intent still has to clear this admin's own permissions --
    // a support admin asking about revenue gets told no, not redirected.
    const permitted = await requireAdmin(intent.permission);
    if (!permitted) {
      return NextResponse.json<CommandResponse>({
        status: "unavailable",
        message: "Your role doesn't have access to that section.",
        detail: `This query maps to a screen requiring the "${intent.permission}" permission.`,
      });
    }

    return NextResponse.json<CommandResponse>({
      status: "routed",
      message: intent.message,
      href: intent.href,
    });
  } catch (error) {
    await recordError({ source: "api/admin/command", error, path: "/api/admin/command" });
    return NextResponse.json<CommandResponse>(
      { status: "error", message: "Something went wrong handling that command." },
      { status: 500 }
    );
  }
}
