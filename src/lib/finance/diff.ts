import type { Holding, PortfolioSnapshot } from "@/types/portfolio";

export interface SnapshotDiff {
  newPositions: Holding[];
  exitedPositions: Holding[];
  increasedPositions: Array<Holding & { previousQuantity: number }>;
  reducedPositions: Array<Holding & { previousQuantity: number }>;
  partialExits: Array<
    Holding & {
      previousQuantity: number;
      quantitySold: number;
      realizedPnL: number;
      pnlType: "BOOKED_PROFIT" | "BOOKED_LOSS";
    }
  >;
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
  const partialExits: Array<
    Holding & {
      previousQuantity: number;
      quantitySold: number;
      realizedPnL: number;
      pnlType: "BOOKED_PROFIT" | "BOOKED_LOSS";
    }
  > = [];

  // Find new, increased, reduced, and partial exit positions
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
      // Reduced position - check if it's a full exit or partial
      const quantitySold = prevHolding.quantity - currHolding.quantity;
      const realizedPnL = quantitySold * (currHolding.currentPrice - prevHolding.avgCost);
      const pnlType = realizedPnL >= 0 ? "BOOKED_PROFIT" : "BOOKED_LOSS";

      if (currHolding.quantity === 0) {
        // This is actually a full exit with final quantity 0
        exitedPositions.push(prevHolding);
      } else {
        // Partial exit
        partialExits.push({
          ...currHolding,
          previousQuantity: prevHolding.quantity,
          quantitySold,
          realizedPnL,
          pnlType,
        });
      }
    }
  }

  // Find exited positions (symbols in previous but not in current, with qty > 0)
  for (const [symbol, prevHolding] of prevHoldingMap.entries()) {
    if (!currHoldingMap.has(symbol) && prevHolding.quantity > 0) {
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
    partialExits,
    totalValueChange,
    totalGainChange,
  };
}
