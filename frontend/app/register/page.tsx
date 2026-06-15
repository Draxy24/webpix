"use client";

import { useTranslation } from "react-i18next";
import RegisterForm from "../components/RegisterForm";
import AuthPageLayout from "../components/AuthPageLayout";

export default function RegisterPage() {
  const { t } = useTranslation();
  return (
    <AuthPageLayout title={t("register.title")}>
      <RegisterForm />
    </AuthPageLayout>
  );
}
