export default function HeaderBar({
  activeBandName,
  activeBandId,
  codeCopied,
  onCopyCode,
  onLogout,
  error,
}) {
  return (
    <header className="flex h-12 flex-shrink-0 items-center gap-3 border-b border-border bg-canvas px-4">
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-text-primary">
        Band OS
      </span>

      {activeBandName && (
        <span className="text-xs text-text-muted">{activeBandName}</span>
      )}

      <div className="flex-1" />

      {activeBandId && (
        <button
          onClick={onCopyCode}
          title="Copy invite code"
          className={`rounded border border-border px-2.5 py-1 text-[11px] tracking-[0.08em] ${
            codeCopied ? "bg-accent/15 text-accent" : "bg-transparent text-text-muted"
          }`}
        >
          {codeCopied ? "Copied!" : `Code: ${activeBandId}`}
        </button>
      )}

      <button
        onClick={onLogout}
        className="border-border text-xs text-text-muted hover:text-text-primary"
      >
        Logout
      </button>

      {error && <span className="text-xs text-danger">{error}</span>}
    </header>
  );
}
