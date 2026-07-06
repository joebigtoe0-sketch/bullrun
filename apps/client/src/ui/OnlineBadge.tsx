export function OnlineBadge({ count }: { count: number | null }) {
  if (count === null) return null;
  return (
    <div className="online-badge">
      <span className="online-badge-dot" aria-hidden />
      <span>{count.toLocaleString()} online</span>
    </div>
  );
}
