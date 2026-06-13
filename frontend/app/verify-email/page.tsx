"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import AuthPageLayout from "../components/AuthPageLayout";
import Button from "../components/Button";
import { API_URL } from "@/app/lib/api";

function VerifyEmailInner() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code");
  const [status, setStatus] = useState<"verifying" | "success" | "error">(
    "verifying",
  );

  useEffect(() => {
    if (!code) {
      setStatus("error");
      return;
    }
    const verify = async () => {
      const res = await fetch(API_URL + "/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      setStatus(res.ok ? "success" : "error");
    };
    verify();
  }, [code]);

  if (status === "verifying") {
    return (
      <AuthPageLayout title={t("verify.link.verifying")}>
        <p
          style={{
            textAlign: "center",
            color: "var(--color-text-secondary)",
            margin: 0,
          }}
        >
          {t("verify.link.validating")}
        </p>
      </AuthPageLayout>
    );
  }

  if (status === "success") {
    return (
      <AuthPageLayout title={t("verify.link.successTitle")}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
              textAlign: "center",
              margin: 0,
            }}
          >
            {t("verify.link.successText")}
          </p>
          <Button fullWidth size="lg" onClick={() => router.push("/")}>
            {t("verify.link.goToCanvas")}
          </Button>
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout title={t("verify.link.invalidTitle")}>
      <p
        style={{
          textAlign: "center",
          color: "var(--color-text-secondary)",
          margin: 0,
        }}
      >
        {t("verify.link.invalidText")}
      </p>
    </AuthPageLayout>
  );
}

export default function VerifyEmailPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <AuthPageLayout title={t("common.loading")}>
          <p
            style={{
              textAlign: "center",
              color: "var(--color-text-secondary)",
              margin: 0,
            }}
          >
            ...
          </p>
        </AuthPageLayout>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
