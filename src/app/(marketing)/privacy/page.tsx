import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
    description: "How Crankcase Garage handles your data — your garage, service history, and account are stored on our server so they sync across your devices.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold text-slate-50">Privacy Policy</h1>
      <p className="mt-4 text-slate-400">
        Crankcase Garage is an early-stage prototype, not a launched public product. There is no
        real Privacy Policy in effect yet — this page is a placeholder so the site has one
        before a real policy is drafted and published ahead of any public launch.
      </p>
      <p className="mt-4 text-slate-400">
        Creating an account stores your email and a securely hashed password. Your garage
        (the vehicles you&apos;ve added), Service History entries, and odometer readings are
        saved to our database under your account, which is what lets them follow you across
        devices when you log in elsewhere. We don&apos;t sell your data or share it with
        third parties.
      </p>
    </div>
  );
}
