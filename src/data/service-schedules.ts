import { GuideFitment, JobTypeId, Vehicle } from "@/types/vehicle";
import { matchesFitment } from "./repairs";

// ---------------------------------------------------------------------------
// FACTORY SERVICE SCHEDULES
//
// Built from a user report asking for "recommendations for specific mileage
// intervals (30k, 100k, etc)". Researching it turned up a bigger problem than
// the request: the generic intervals in src/lib/reminders.ts are wrong for
// every vehicle we have a real schedule for, and wrong in the direction that
// costs the reader money.
//
//   generic table said          the owner's manual actually says
//   oil 5,000 mi / 6 mo         the OIL LIFE MONITOR decides. No mileage at all.
//   engine air filter 15,000    45,000 mi on K2XX; monitor-governed on T1XX
//   cabin air filter 15,000     22,500 mi
//   coolant 30,000              150,000 mi
//   transmission 60,000         no scheduled change under normal service
//
// A product whose whole pitch is honest DIY information against quick-lube
// upselling cannot itself be telling people to change coolant five times more
// often than GM does. So these schedules are both the feature and the fix.
//
// THREE RULES THIS FILE EXISTS TO ENFORCE
//
// 1. A monitor-governed interval is NEVER converted to a mileage. If the
//    manual says the monitor decides, the answer is "the monitor decides".
//    Chevrolet's own marketing site says 7,500 miles for oil; the owner's
//    manual sets no mileage whatsoever. The manual wins.
// 2. "No published interval" is NOT "lifetime fill". GM's schedule has no
//    axle fluid row at all - front or rear, either generation, normal or
//    severe. That is an absence, and saying "lifetime" would be inventing a
//    claim the manufacturer never made.
// 3. Anything we could not source says so. An unknown renders as unknown.
//
// Schedules key on the SAME fitment keys the guides use, through the same
// matcher, so a sibling vehicle inherits one automatically.
// ---------------------------------------------------------------------------

export type IntervalRule =
  | { kind: "miles"; miles: number; months?: number }
  | { kind: "months"; months: number }
  | { kind: "monitor"; monitorName: string; outerMiles?: number; outerMonths?: number }
  | { kind: "inspect"; miles?: number; months?: number }
  | { kind: "none" }
  | { kind: "unknown" };

export type SourceConfidence = "high" | "medium" | "low";

export interface ServiceScheduleItem {
  /** Links the row to a guide we ship, when one exists for this job. */
  jobType?: JobTypeId;
  label: string;
  normal: IntervalRule;
  /** Only set when the manufacturer's severe schedule actually differs. */
  severe?: IntervalRule;
  note?: string;
  confidence: SourceConfidence;
}

export interface ServiceSchedule {
  fitment: GuideFitment;
  /** What the manufacturer's own table is organised around, in miles. */
  gridStep: number;
  gridTo: number;
  /** The manufacturer's wording for what counts as severe service. */
  severeDefinition: string;
  sourceLabel: string;
  items: ServiceScheduleItem[];
}

export const SERVICE_SCHEDULES: ServiceSchedule[] = [
{
fitment: { on: "platform", key: "gm-k2xx-1500" },
gridStep: 7500,
gridTo: 150000,
severeDefinition: "Mainly short trips in heavy city traffic in hot weather, mainly hilly or mountainous terrain, frequent trailer towing, high-speed or competitive driving, or taxi, police and delivery use.",
sourceLabel: "2018 Chevrolet Silverado 1500 owner's manual, Maintenance Schedule pp. 442-448",
items: [
{
jobType: "oil-change",
label: "Engine oil and filter",
normal: { kind: "monitor", monitorName: "GM Oil Life System", outerMonths: 12 },
confidence: "high",
note: "The manual sets NO mileage for oil. Change it when CHANGE ENGINE OIL SOON appears - within 600 miles of the message - and at least once a year regardless. Reset the system afterwards. You will see 7,500 miles quoted everywhere including Chevrolet's own support site; that number is not in the owner's manual, and it is the tire rotation interval bleeding into the oil row.",
},
{
jobType: "tire-rotation",
label: "Tire rotation",
normal: { kind: "miles", miles: 7500 },
confidence: "high",
note: "This is the interval the whole schedule is built around - every other service lands on a multiple of it.",
},
{
jobType: "engine-air-filter",
label: "Engine air filter",
normal: { kind: "miles", miles: 45000, months: 48 },
confidence: "medium",
note: "Or every four years, whichever comes first. Inspect it at each oil change if you drive in dust. Some chain-shop schedules say 22,500 miles for this - that is twice as often as GM asks for.",
},
{
jobType: "cabin-air-filter",
label: "Cabin air filter",
normal: { kind: "miles", miles: 22500, months: 24 },
confidence: "high",
note: "More often if you sit in heavy traffic or drive in dust.",
},
{
label: "Brake fluid",
normal: { kind: "months", months: 60 },
confidence: "medium",
note: "Time only - there is deliberately no mileage on this row. Note that 2015 and 2016 GM schedules said every three years; the 2018 manual says five. If your truck is an early one, use three.",
},
{
jobType: "coolant",
label: "Engine coolant",
normal: { kind: "miles", miles: 150000, months: 60 },
confidence: "medium",
note: "DEX-COOL is a long-life coolant and the schedule reflects that. Five years is the practical limit for most people, not the mileage.",
},
{
label: "Automatic transmission fluid and filter",
normal: { kind: "none" },
severe: { kind: "miles", miles: 45000 },
confidence: "high",
note: "There is no transmission fluid row in GM's normal schedule at all. It appears only under severe service. That is not the same as saying it never needs doing - it is saying GM does not schedule it unless you work the truck.",
},
{
jobType: "driveline-fluid",
label: "Front and rear axle fluid",
normal: { kind: "none" },
confidence: "high",
note: "GM publishes no scheduled interval for axle fluid on this truck - no row exists in either the normal or the severe table. That is an absence, NOT a lifetime fill claim, and we are not going to invent one. Plenty of owners change it anyway, which is why the guide exists.",
},
{
label: "Transfer case fluid (4WD)",
normal: { kind: "unknown" },
severe: { kind: "miles", miles: 45000 },
confidence: "low",
note: "The severe figure is solid. The normal-service interval sits in a single unreadable column of GM's table and splits by GVW above and below 8,600 lb, so we are not guessing at it. Check your own manual.",
},
{
label: "Spark plugs",
normal: { kind: "miles", miles: 97500 },
confidence: "medium",
note: "Reference figure. It matches GM's iridium plug spec and two secondary sources, but we could not read it cleanly off the manual's table. Not a job this site covers on this engine.",
},
{
jobType: "serpentine-belt",
label: "Drive belt",
normal: { kind: "inspect", months: 120 },
confidence: "medium",
note: "Inspection, not replacement. GM asks you to look for fraying, heavy cracking or damage and replace only if needed, or at ten years.",
},
],
},
{
fitment: { on: "platform", key: "gm-t1xx-1500" },
gridStep: 7500,
gridTo: 150000,
severeDefinition: "Mainly short trips in heavy city traffic in hot weather, mainly hilly or mountainous terrain, frequent trailer towing, high-speed or competitive driving, or taxi, police and delivery use.",
sourceLabel: "2021 Chevrolet Silverado 1500 owner's manual, Maintenance Schedule pp. 412-417",
items: [
{
jobType: "oil-change",
label: "Engine oil and filter",
normal: { kind: "monitor", monitorName: "GM Oil Life System", outerMonths: 12 },
confidence: "high",
note: "Word for word the same policy as the 2014-2018 truck. No mileage in the manual; change within 600 miles of the CHANGE ENGINE OIL SOON message, and at least once a year. Reset the system afterwards.",
},
{
jobType: "tire-rotation",
label: "Tire rotation",
normal: { kind: "miles", miles: 7500 },
confidence: "high",
},
{
jobType: "engine-air-filter",
label: "Engine air filter",
normal: { kind: "monitor", monitorName: "engine air filter life monitor" },
confidence: "high",
note: "This is the one that genuinely changed between generations. The 2019-and-later truck has an air filter life monitor: the schedule has you CHECK the percentage at every 7,500 mile service and replace it when the truck says so. Do not use the older truck's 45,000 mile figure here.",
},
{
jobType: "cabin-air-filter",
label: "Cabin air filter",
normal: { kind: "miles", miles: 22500, months: 24 },
confidence: "medium",
note: "The two-year limit is firm in the manual footnote; the mileage column was harder to read cleanly. Treat 22,500 as a working figure and check your own manual if you want certainty.",
},
{
label: "Brake fluid",
normal: { kind: "months", months: 60 },
confidence: "medium",
note: "Time only. No mileage on this row.",
},
{
jobType: "coolant",
label: "Engine coolant",
normal: { kind: "miles", miles: 150000, months: 60 },
confidence: "medium",
},
{
label: "Automatic transmission fluid and filter",
normal: { kind: "none" },
severe: { kind: "miles", miles: 45000 },
confidence: "high",
note: "Same as the older truck: absent from the normal schedule, 45,000 miles under severe service.",
},
{
jobType: "driveline-fluid",
label: "Front and rear axle fluid",
normal: { kind: "none" },
confidence: "high",
note: "No scheduled interval published, same as the previous generation. An absence, not a lifetime fill.",
},
{
label: "Transfer case fluid (4WD)",
normal: { kind: "unknown" },
severe: { kind: "miles", miles: 45000 },
confidence: "low",
note: "The 2019-and-later schedule drops the GVW split the older truck had, but the normal-service column is still unreadable. Severe service is 45,000 miles.",
},
{
label: "Spark plugs",
normal: { kind: "miles", miles: 97500 },
confidence: "low",
note: "Genuine conflict between sources on this row - 75,000, 90,000 and 97,500 all appear. Verify against your own manual before planning around it. The 2.7L turbo is on a much shorter interval and does not apply to the 5.3L.",
},
{
jobType: "serpentine-belt",
label: "Drive belt",
normal: { kind: "inspect", months: 120 },
confidence: "medium",
note: "Inspection only. Worth knowing before you start: this truck has no belt tensioner and runs stretch-fit belts that cannot be reused, so a look is cheap and a replacement is not.",
},
],
},
{
fitment: { on: "platform", key: "jeep-wk2" },
gridStep: 10000,
gridTo: 150000,
severeDefinition: "Dusty or off-road operation, frequent short trips, heavy trailer towing, or extended idling.",
sourceLabel: "2014 Jeep Grand Cherokee owner's manual (US), oil policy p. 575, schedule pp. 631-637",
items: [
{
jobType: "oil-change",
label: "Engine oil and filter",
normal: { kind: "monitor", monitorName: "Oil Change Indicator", outerMiles: 10000, outerMonths: 12 },
severe: { kind: "miles", miles: 4000 },
confidence: "high",
note: "The indicator decides, but Jeep does put a ceiling on it: under no circumstances beyond 10,000 miles or twelve months. The message can appear as early as 3,500 miles. If you run it dusty or off road, the manual asks for 4,000 miles flat.",
},
{
jobType: "tire-rotation",
label: "Tire rotation",
normal: { kind: "miles", miles: 10000 },
confidence: "high",
note: "The whole Jeep schedule runs on a 10,000 mile grid, and each column is also indexed to a year.",
},
{
jobType: "engine-air-filter",
label: "Engine air filter",
normal: { kind: "miles", miles: 30000 },
confidence: "medium",
note: "Inspect sooner if you drive in dust or off road.",
},
{
jobType: "cabin-air-filter",
label: "Cabin air filter",
normal: { kind: "miles", miles: 20000 },
confidence: "medium",
},
{
jobType: "coolant",
label: "Engine coolant",
normal: { kind: "miles", miles: 150000, months: 120 },
confidence: "medium",
note: "Ten years, not the five GM asks for.",
},
{
label: "Brake fluid",
normal: { kind: "unknown" },
confidence: "low",
note: "We could not find a brake fluid row in the US schedule at all. An international edition of the same manual says every 24 months. Rather than publish a number from the wrong market, this stays unknown - check your own book.",
},
{
label: "Automatic transmission fluid",
normal: { kind: "unknown" },
confidence: "low",
note: "No row surfaced in the US schedule. You will read that this transmission is filled for life; we could not source that from the manual, so we are not saying it.",
},
{
jobType: "driveline-fluid",
label: "Axle fluid",
normal: { kind: "unknown" },
confidence: "low",
note: "Sources conflict badly here - the manual's table reads as every 30,000 miles, one maintenance aggregator says a single service at 120,000. Those are too far apart to split the difference, so we are reporting neither as fact.",
},
{
label: "Transfer case fluid",
normal: { kind: "unknown" },
confidence: "low",
note: "One unreadable column. Candidates were 120,000 and 150,000 miles.",
},
{
label: "Spark plugs",
normal: { kind: "unknown" },
confidence: "low",
note: "Three research passes returned three different figures off the same table. Genuinely unresolved. Note also that spark plugs are out of scope on this engine anyway - the rear bank sits under the intake plenum.",
},
],
},
];

export function getServiceSchedule(vehicle: Vehicle): ServiceSchedule | null {
  for (const s of SERVICE_SCHEDULES) {
    if (matchesFitment(s.fitment, vehicle)) return s;
  }
  return null;
}

/** True only for a fixed-mileage rule landing exactly on this milestone. */
function dueAt(rule: IntervalRule, miles: number): boolean {
  return rule.kind === "miles" && miles % rule.miles === 0;
}

export interface Milestone {
  miles: number;
  /** Due on the manufacturer's normal schedule. */
  normal: ServiceScheduleItem[];
  /** Due only if the truck is worked - towing, dust, city heat, plough duty. */
  severeOnly: ServiceScheduleItem[];
}

/**
 * The "what is due at 30,000" view, derived from the intervals rather than
 * hand-written per milestone. One source of truth: fix an interval and every
 * milestone that depends on it moves with it.
 *
 * Monitor-governed and unknown rows never appear here, by design. Putting
 * "engine oil" under a mileage heading is exactly the error this whole file
 * exists to avoid - those rows are surfaced separately, in words.
 */
export function milestonesFor(schedule: ServiceSchedule, limit = 12): Milestone[] {
  const out: Milestone[] = [];
  for (let m = schedule.gridStep; m <= schedule.gridTo && out.length < limit; m += schedule.gridStep) {
    const normal = schedule.items.filter((i) => dueAt(i.normal, m));
    const severeOnly = schedule.items.filter(
      (i) => i.severe !== undefined && dueAt(i.severe, m) && !dueAt(i.normal, m),
    );
    if (normal.length > 0 || severeOnly.length > 0) out.push({ miles: m, normal, severeOnly });
  }
  return out;
}

/** The rows that deliberately have no mileage, with the reason. */
export function nonMileageItems(schedule: ServiceSchedule): ServiceScheduleItem[] {
  return schedule.items.filter(
    (i) => i.normal.kind !== "miles" || (i.severe !== undefined && i.severe.kind !== "miles"),
  );
}

export function describeInterval(rule: IntervalRule): string {
  switch (rule.kind) {
    case "miles":
      return rule.months !== undefined
        ? formatMiles(rule.miles) + " miles or " + formatMonths(rule.months)
        : formatMiles(rule.miles) + " miles";
    case "months":
      return formatMonths(rule.months);
    case "monitor": {
      let s = "When the " + rule.monitorName + " says so";
      const caps: string[] = [];
      if (rule.outerMiles !== undefined) caps.push(formatMiles(rule.outerMiles) + " miles");
      if (rule.outerMonths !== undefined) caps.push(formatMonths(rule.outerMonths));
      if (caps.length > 0) s += " - never beyond " + caps.join(" or ");
      return s;
    }
    case "inspect":
      return rule.months !== undefined
        ? "Inspect only, or replace at " + formatMonths(rule.months)
        : "Inspect only";
    case "none":
      return "No scheduled interval published";
    case "unknown":
      return "Not published in a source we could verify";
  }
}

function formatMiles(n: number): string {
  return n.toLocaleString("en-US");
}

function formatMonths(n: number): string {
  if (n % 12 === 0) {
    const y = n / 12;
    return y === 1 ? "1 year" : y + " years";
  }
  return n + " months";
}
