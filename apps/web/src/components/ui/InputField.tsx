"use client";

import { useId, useState } from "react";

interface InputFieldProps {
  label:         string;
  type?:         string;
  value:         string;
  onChange:      (v: string) => void;
  placeholder?:  string;
  required?:     boolean;
  disabled?:     boolean;
  error?:        string;
  hint?:         string;
  autoComplete?: string;
  min?:          string | number;
  max?:          string | number;
  step?:         string | number;
  onBlur?:       () => void;
  autoFocus?:    boolean;
}

export function InputField({
  label, type = "text", value, onChange,
  placeholder, required, disabled, error, hint,
  autoComplete, min, max, step,
  onBlur, autoFocus,
}: InputFieldProps) {
  const id = useId();
  const [showPass, setShowPass] = useState(false);

  const inputType = type === "password" ? (showPass ? "text" : "password") : type;

  return (
    <div>
      <label htmlFor={id} className="form-label">
        {label}
        {required && <span style={{ color: "var(--gold)", marginLeft: 3 }}>*</span>}
      </label>

      <div style={{ position: "relative" }}>
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          min={min}
          max={max}
          step={step}
          onBlur={onBlur}
          autoFocus={autoFocus}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          style={error ? { borderColor: "var(--tension)" } : undefined}
        />
        {type === "password" && (
          <button
            type="button"
            onClick={() => setShowPass(s => !s)}
            style={{
              position: "absolute", right: 14, top: "50%",
              transform: "translateY(-50%)", background: "none",
              border: "none", cursor: "pointer",
              color: "var(--muted-2)", padding: 4,
              fontSize: 15, lineHeight: 1,
            }}
            aria-label={showPass ? "Masquer" : "Afficher"}
          >
            {showPass ? "○" : "●"}
          </button>
        )}
      </div>

      {error && (
        <p
          id={`${id}-err`}
          role="alert"
          style={{ fontSize: 12, color: "var(--tension)", margin: "4px 0 0" }}
        >
          {error}
        </p>
      )}
      {hint && !error && (
        <p
          id={`${id}-hint`}
          style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

// AUTH-UX-POLISH-V1 applied

// ARCHIVE-INPUTFIELD-FIX-V1 applied
