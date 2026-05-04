// Test fixture — should fail both checks
// Uses banned class `btn-primary` and undeclared CSS var `--gold-glow`
export function BadComponent() {
  return (
    <div
      className="btn-primary glass form-error"
      style={{ background: 'var(--gold-glow)', color: 'var(--undeclared-color)' }}
    >
      Bad
    </div>
  );
}
