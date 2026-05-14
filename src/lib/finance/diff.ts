import type { Holding, PortfolioSnapshot } from "@/types/portfolio";

export interface SnapshotDiff {
  newPositions: Holding[];
  exitedPositions: Holding[];
  increasedPositions: Array<Holding & { previousQuantity: number }>;
  reducedPositions: Array<Holding & { previousQuantity: number }>;
  totalValueChange: {
    absolute: number;
    percentage: number;
  };
  totalGainChange: {
    absolute: number;
    percentage: number;
  };
}

/**
 * Compares two portfolio snapshots and returns the differences.
 * All holdings are from the current snapshot, with additional context about changes.
 */
export function calcSnapshotDiff(
  previous: PortfolioSnapshot,
  current: PortfolioSnapshot,
): SnapshotDiff {
  // Create maps for quick lookup
  const prevHoldingMap = new Map(previous.holdings.map((h) => [h.symbol, h]));
  const currHoldingMap = new Map(current.holdings.map((h) => [h.symbol, h]));

  const newPositions: Holding[] = [];
  const exitedPositions: Holding[] = [];
  const increasedPositions: Array<Holding & { previousQuantity: number }> = [];
  const reducedPositions: Array<Holding & { previousQuantity: number }> = [];

  // Find new, increased, and reduced positions
  for (const [symbol, currHolding] of currHoldingMap.entries()) {
    const prevHolding = prevHoldingMap.get(symbol);

    if (!prevHolding) {
      // New position
      newPositions.push(currHolding);
    } else if (currHolding.quantity > prevHolding.quantity) {
      // Increased position
      increasedPositions.push({
        ...currHolding,
        previousQuantity: prevHolding.quantity,
      });
    } else if (currHolding.quantity < prevHolding.quantity) {
      // Reduced position
      reducedPositions.push({
        ...currHolding,
        previousQuantity: prevHolding.quantity,
      });
    }
  }

  // Find exited positions
  for (const [symbol, prevHolding] of prevHoldingMap.entries()) {
    if (!currHoldingMap.has(symbol)) {
      exitedPositions.push(prevHolding);
    }
  }

  // Calculate value change
  const totalValueChange = {
    absolute: current.totalValue - previous.totalValue,
    percentage:
      previous.totalValue !== 0
        ? ((current.totalValue - previous.totalValue) / previous.totalValue) * 100
        : 0,
  };

  // Calculate gain change
  const totalGainChange = {
    absolute: current.totalGain - previous.totalGain,
    percentage:
      previous.totalGain !== 0
        ? ((current.totalGain - previous.totalGain) / previous.totalGain) * 100
        : current.totalGain !== 0
          ? 100
          : 0,
  };

  return {
    newPositions,
    exitedPositions,
    increasedPositions,
    reducedPositions,
    totalValueChange,
    totalGainChange,
  };
}
