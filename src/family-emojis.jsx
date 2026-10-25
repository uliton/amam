import React from "react";

export function FamilyEmojis({ children, demoMode = false }) {
  const items = demoMode
    ? [{ id: "demo", name: "Демо", emoji: "🌱" }]
    : children;
  const count = items.length;
  if (!count) return null;
  const dense = count > 12;
  const compact = count > 4;
  const columns = Math.min(count, dense ? 10 : 8);
  const size = dense ? 18 : 22;
  const step = dense ? 10 : compact ? 15 : 28;
  return (
    <span
      className={`family-emojis${compact ? " family-emojis--compact" : ""}`}
      aria-hidden="true"
      style={{
        "--emoji-columns": columns,
        "--emoji-size": `${size}px`,
        "--emoji-step": `${step}px`,
        "--emoji-row": `${dense ? 21 : 26}px`,
      }}
    >
      {items.map((child, index) => (
        <span
          className="family-emoji"
          key={child.id}
          title={child.name}
          style={{ zIndex: count - index }}
        >
          {child.emoji}
        </span>
      ))}
    </span>
  );
}
