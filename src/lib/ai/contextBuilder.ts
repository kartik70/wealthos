import type { Holding, PortfolioSnapshot } from "../../types/portfolio";

export function buildSnapshotContextString(
  snapshot: PortfolioSnapshot,
  holdings: Holding[],
): string {
  const top10 = [...holdings]
    .sort((a, b) => b.allocationPct - a.allocationPct)
    .slice(0, 10)
    .map(
      (h) =>
        `${h.symbol}: ₹${h.currentValue.toFixed(0)} (${h.allocationPct.toFixed(1)}%, ${h.unrealisedGainPct >= 0 ? "+" : ""}${h.unrealisedGainPct.toFixed(1)}%)`,
    )
    .join(", ");

  return (
    `Portfolio on ${formatDate(snapshot.createdAt)}: ` +
    `Total ₹${snapshot.totalValue.toFixed(0)}, ` +
    `Gain ₹${snapshot.totalGain.toFixed(0)} (${snapshot.totalGainPct.toFixed(2)}%). ` +
    `Top 10 holdings: ${top10}.`
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
