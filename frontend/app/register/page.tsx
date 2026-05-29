"use client";

import RegisterForm from "../components/RegisterForm";
import AuthPageLayout from "../components/AuthPageLayout";

export default function RegisterPage() {
  return (
    <AuthPageLayout title="Crear cuenta">
      <RegisterForm />
    </AuthPageLayout>
  );
}
