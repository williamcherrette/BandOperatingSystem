export default function SelectionBar({
  selectedCount,
  onClear,
  onDownload,
  isLoading,
  onSave,
  onLiveMode,
}) {
  return (
    <section className="flex flex-wrap items-center gap-2.5 border-b border-accent/20 bg-accent/8 px-4 py-2.5">
      <span className="flex-1 text-xs font-medium text-accent">
        {selectedCount} song{selectedCount > 1 ? "s" : ""} selected
      </span>
      <button onClick={onClear} className="border-danger/30 text-danger">
        Clear
      </button>
      <button onClick={onDownload} disabled={isLoading}>
        {isLoading ? "Building…" : "Download PDF"}
      </button>
      <button
        onClick={onSave}
        className="border-transparent bg-text-primary text-canvas hover:bg-text-secondary"
      >
        Save Setlist
      </button>
      <button
        type="button"
        onClick={onLiveMode}
        className="border-accent/40 text-accent"
        title="Live Mode is next in implementation"
      >
        Live Mode
      </button>
    </section>
  );
}
