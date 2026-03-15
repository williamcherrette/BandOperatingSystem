const tabs = [
  { id: "songs", label: "Songs" },
  { id: "setlists", label: "Setlists" },
  { id: "live", label: "Live Mode" },
  { id: "members", label: "Members" },
];

export default function NavTabs({ activeTab, onTabChange }) {
  return (
    <nav className="flex border-b border-border bg-canvas px-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`rounded-none border-x-0 border-t-0 border-b-2 px-4 py-2 text-xs tracking-wide ${
            activeTab === tab.id
              ? "border-accent text-text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
