import type { Metadata } from "next";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create your free Crankcase garage — specs, fluids, and one guide per vehicle, always free.",
};

export default function SignupPage() {
  return <SignupForm />;
}
