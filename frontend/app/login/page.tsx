"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import LoginForm from "../components/LoginForm";
import AuthPageLayout from "../components/AuthPageLayout";

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <AuthPageLayout title={t("auth.login.title")}>
      <LoginForm onSuccess={() => router.push("/")} />
    </AuthPageLayout>
  );
}
