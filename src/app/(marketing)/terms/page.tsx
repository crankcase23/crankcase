import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Crankcase's scope of service and terms — routine maintenance reference only, not a substitute for a professional mechanic.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold text-slate-50">Terms of Service</h1>
      <p className="mt-4 text-slate-400">
        Crankcase is an early-stage prototype, not a launched public product. There is no
        real Terms of Service in effect yet — this page is a placeholder so the site has one
        before real terms are drafted and published ahead of any public launch.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-slate-100">Scope of Service</h2>
      <p className="mt-3 text-slate-400">
        Crankcase is intended to help with routine, basic vehicle maintenance — things like
        oil and filter changes, fluid top-offs and flushes, brake pad replacement, tire
        rotations, and similar tasks you can reasonably complete in a driveway or garage.
      </p>
      <p className="mt-3 text-slate-400">
        It is <strong className="text-slate-200">not</strong> intended for engine rebuilds,
        camshaft or valvetrain work, transmission work, or other medium-to-heavy repairs. If
        a job goes beyond routine maintenance, please consult a qualified professional
        mechanic rather than relying on this site.
      </p>

      <p className="mt-8 text-slate-400">
        More generally: nothing here today, from specs to torque values to repair steps, is a
        substitute for your vehicle&apos;s factory service manual. Work on your vehicle at
        your own risk and use proper safety equipment.
      </p>
    </div>
  );
}
