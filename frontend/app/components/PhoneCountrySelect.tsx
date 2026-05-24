"use client";

import { useState, useRef, useEffect } from "react";
import { COUNTRIES } from "../lib/countries";
import Flag from "./Flag";

export default function PhoneCountrySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = COUNTRIES.find((c) => c.code === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "8px",
          cursor: "pointer",
          border: "1px solid #888",
          background: "#fff",
          color: "#000",
          height: "100%",
          whiteSpace: "nowrap",
        }}
      >
        {selected && <Flag code={selected.code} />}
        <span style={{ fontSize: "14px" }}>{selected?.dialCode}</span>
        <span style={{ fontSize: "10px" }}>▼</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 100,
            background: "#fff",
            color: "#000",
            border: "1px solid #888",
            borderRadius: "4px",
            maxHeight: "240px",
            overflowY: "auto",
            width: "240px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          }}
        >
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => {
                onChange(c.code);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                padding: "8px",
                cursor: "pointer",
                border: "none",
                background: c.code === value ? "#eee" : "#fff",
                textAlign: "left",
              }}
            >
              <Flag code={c.code} />
              <span style={{ flex: 1, fontSize: "13px" }}>{c.name}</span>
              <span style={{ color: "#888", fontSize: "13px" }}>
                {c.dialCode}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
