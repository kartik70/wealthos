import type { HealthScoreResult, Holding } from "@/types/portfolio";
import type { SectorAllocation } from "@/types/portfolio";

import { classifySectorsSync } from "./sector-map";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundScore(value: number): number {
  return Math.round(clamp(value, 0, 100));
}

export function calcHealthScore(holdings: Holding[]): HealthScoreResult {
  return calcHealthScoreWithSectors(holdings, classifySectorsSync(holdings));
}

export function calcHealthScoreWithSectors(
  holdings: Holding[],
  sectors: SectorAllocation[],
): HealthScoreResult {
  if (holdings.length === 0) {
    return {
      score: 0,
      breakdown: {
        concentration: 0,
        diversification: 0,
        lossRatio: 0,
        sectorBalance: 0,
      },
    };
  }

  const topAllocation = holdings.reduce(
    (maxValue, holding) => Math.max(maxValue, holding.allocationPct),
    0,
  );
  const concentration = roundScore(100 - Math.max(0, topAllocation - 10) * 4);

  const diversification = roundScore((Math.min(holdings.length, 12) / 12) * 100);

  const lossCount = holdings.filter((holding) => holding.unrealisedGain < 0).length;
  const lossRatio = roundScore(100 - (lossCount / holdings.length) * 100);

  const hhi = sectors.reduce(
    (sum, sector) => sum + (sector.allocationPct / 100) ** 2,
    0,
  );
  const effectiveSectorCount = hhi === 0 ? 0 : 1 / hhi;
  const sectorBalance = roundScore((Math.min(effectiveSectorCount, 8) / 8) * 100);

  const weightedScore =
    concentration * 0.35 + diversification * 0.25 + lossRatio * 0.2 + sectorBalance * 0.2;

  return {
    score: roundScore(weightedScore),
    breakdown: {
      concentration,
      diversification,
      lossRatio,
      sectorBalance,
    },
  };
}
