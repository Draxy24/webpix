"use client";

import { useRouter } from "next/navigation";
import LoginForm from "../components/LoginForm";
import AuthPageLayout from "../components/AuthPageLayout";

export default function LoginPage() {
  const router = useRouter();
  return (
    <AuthPageLayout title="Iniciar sesión">
      <LoginForm onSuccess={() => router.push("/")} />
    </AuthPageLayout>
  );
}
