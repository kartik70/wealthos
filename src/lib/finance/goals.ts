export function calcLumpSumProjection(
  currentValue: number,
  annualReturn: number,
  years: number,
): number {
  if (currentValue <= 0 || years <= 0) {
    return Math.max(0, currentValue);
  }

  const annualRate = annualReturn / 100;
  return currentValue * (1 + annualRate) ** years;
}

export function calcGoalProgress(
  combinedPortfolioValue: number,
  targetCorpus: number,
): number {
  if (targetCorpus <= 0) {
    return 0;
  }

  const progress = (combinedPortfolioValue / targetCorpus) * 100;
  return Math.max(0, Math.min(100, progress));
}

export function calcYearsToGoal(
  combinedPortfolioValue: number,
  targetCorpus: number,
  annualReturn: number,
): number {
  if (targetCorpus <= 0) {
    return 0;
  }

  if (combinedPortfolioValue >= targetCorpus) {
    return 0;
  }

  if (combinedPortfolioValue <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const annualRate = annualReturn / 100;
  if (annualRate <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const numerator = Math.log(targetCorpus / combinedPortfolioValue);
  const denominator = Math.log(1 + annualRate);

  if (denominator === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return numerator / denominator;
}
