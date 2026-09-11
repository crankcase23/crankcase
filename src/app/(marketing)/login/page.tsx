import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Log In",
  description: "Log in to your Crankcase garage.",
};

export default function LoginPage() {
  return <LoginForm />;
}
