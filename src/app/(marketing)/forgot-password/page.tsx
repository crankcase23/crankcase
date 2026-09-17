import type { Metadata } from "next";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your Crankcase Garage password.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
