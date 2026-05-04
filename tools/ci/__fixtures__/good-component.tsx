// Test fixture — uses only declared CSS vars and valid classes
export function GoodComponent() {
  return (
    <div
      className="btn-ob card"
      style={{ background: 'var(--gold)', borderColor: 'var(--border)' }}
    >
      Hello
    </div>
  );
}
