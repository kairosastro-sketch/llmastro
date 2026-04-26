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
}

export function InputField({
  label, type = "text", value, onChange,
  placeholder, required, disabled, error, hint,
  autoComplete, min, max, step,
}: InputFieldProps) {
  const id = useId();
  const [showPass, setShowPass] = useState(false);

  const inputType = type === "password" ? (showPass ? "text" : "password") : type;

  return (
    <div>
      <label htmlFor={id} className="label">
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
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          className={`input${type === "select" ? " select" : ""}`}
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
              color: "var(--text-muted)", padding: 4,
              fontSize: 15, lineHeight: 1,
            }}
            aria-label={showPass ? "Masquer" : "Afficher"}
          >
            {showPass ? "○" : "●"}
          </button>
        )}
      </div>

      {error && <p id={`${id}-err`}  className="form-error" role="alert">{error}</p>}
      {hint && !error && <p id={`${id}-hint`} className="form-hint">{hint}</p>}
    </div>
  );
}
