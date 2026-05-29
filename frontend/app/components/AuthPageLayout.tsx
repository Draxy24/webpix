"use client";

export default function AuthPageLayout({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          width: "360px",
          maxWidth: "100%",
          padding: "var(--space-6)",
          background: "var(--color-surface)",
          border: "var(--border-normal) solid var(--color-border-strong)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        {title && (
          <h1
            style={{
              textAlign: "center",
              margin: "0 0 var(--space-6) 0",
              fontFamily: "var(--font-display), monospace",
              fontSize: "var(--text-lg)",
            }}
          >
            {title}
          </h1>
        )}
        {children}
      </div>
    </main>
  );
}
