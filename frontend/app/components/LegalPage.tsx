import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

const mdComponents: Components = {
  h1: ({ children }) => (
    <h1
      style={{
        fontSize: "1.9rem",
        fontWeight: 700,
        color: "var(--color-text)",
        lineHeight: 1.2,
        marginBottom: "1.5rem",
      }}
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      style={{
        fontSize: "1.3rem",
        fontWeight: 700,
        color: "var(--color-text)",
        marginTop: "2rem",
        marginBottom: "0.75rem",
      }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      style={{
        fontSize: "1.1rem",
        fontWeight: 600,
        color: "var(--color-text)",
        marginTop: "1.5rem",
        marginBottom: "0.5rem",
      }}
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p
      style={{
        color: "var(--color-text-secondary)",
        lineHeight: 1.7,
        marginBottom: "1rem",
      }}
    >
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul
      style={{
        color: "var(--color-text-secondary)",
        lineHeight: 1.7,
        marginBottom: "1rem",
        paddingLeft: "1.5rem",
      }}
    >
      {children}
    </ul>
  ),
  li: ({ children }) => <li style={{ marginBottom: "0.4rem" }}>{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      style={{ color: "var(--color-brand)", textDecoration: "none" }}
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong style={{ color: "var(--color-text)", fontWeight: 700 }}>
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em
      style={{
        color: "var(--color-text-muted)",
        fontStyle: "normal",
        fontSize: "0.9rem",
      }}
    >
      {children}
    </em>
  ),
};

export default function LegalPage({ content }: { content: string }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--color-bg)",
        padding: "3rem 1.5rem",
      }}
    >
      <div
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          fontFamily: "var(--font-body)",
        }}
      >
        <a
          href="/"
          style={{
            color: "var(--color-brand)",
            textDecoration: "none",
            fontSize: "0.9rem",
            display: "inline-block",
            marginBottom: "2rem",
          }}
        >
          ← Volver a WebPix
        </a>
        <ReactMarkdown components={mdComponents}>{content}</ReactMarkdown>
      </div>
    </main>
  );
}
