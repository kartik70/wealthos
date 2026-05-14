"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import type { Holding } from "@/types/portfolio";

interface AllocationChartProps {
  holdings: Holding[];
}

interface AllocationDatum {
  symbol: string;
  name: string;
  allocationPct: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: AllocationDatum; value: number }>;
}

const chartColors = [
  "#2563eb",
  "#059669",
  "#dc2626",
  "#7c3aed",
  "#ca8a04",
  "#0891b2",
  "#db2777",
  "#4f46e5",
  "#64748b",
];

export function AllocationChart({ holdings }: AllocationChartProps) {
  const data = buildAllocationData(holdings);

  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        No allocation data
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="allocationPct"
            nameKey="symbol"
            innerRadius={62}
            outerRadius={96}
            paddingAngle={2}
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.symbol}
                fill={chartColors[index % chartColors.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            wrapperStyle={{ fontSize: 12, lineHeight: "20px" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function buildAllocationData(holdings: Holding[]): AllocationDatum[] {
  const sortedHoldings = [...holdings].sort(
    (left, right) => right.allocationPct - left.allocationPct,
  );
  const topHoldings = sortedHoldings.slice(0, 8).map((holding) => ({
    symbol: holding.symbol,
    name: holding.name,
    allocationPct: holding.allocationPct,
  }));
  const othersAllocation = sortedHoldings
    .slice(8)
    .reduce((total, holding) => total + holding.allocationPct, 0);

  if (othersAllocation > 0) {
    topHoldings.push({
      symbol: "Others",
      name: "Others",
      allocationPct: othersAllocation,
    });
  }

  return topHoldings;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    const value = payload[0].value;
    return (
      <div className="rounded bg-white p-2 shadow-md">
        <p className="text-sm font-semibold">
          {data.symbol}: {Number.isFinite(value) ? value.toFixed(2) : 0}%
        </p>
      </div>
    );
  }
  return null;
}
