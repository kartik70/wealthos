"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { ValueType } from "recharts/types/component/DefaultTooltipContent";

import type { Holding } from "@/types/portfolio";

interface AllocationChartProps {
  holdings: Holding[];
}

interface AllocationDatum {
  symbol: string;
  allocationPct: number;
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
          <Tooltip formatter={formatTooltipValue} />
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
    allocationPct: holding.allocationPct,
  }));
  const othersAllocation = sortedHoldings
    .slice(8)
    .reduce((total, holding) => total + holding.allocationPct, 0);

  if (othersAllocation > 0) {
    topHoldings.push({
      symbol: "Others",
      allocationPct: othersAllocation,
    });
  }

  return topHoldings;
}

function formatTooltipValue(value: ValueType | undefined): [string, string] {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const numericValue = typeof rawValue === "number" ? rawValue : Number(rawValue);
  const formattedValue = Number.isFinite(numericValue)
    ? `${numericValue.toFixed(2)}%`
    : String(rawValue);

  return [formattedValue, "Allocation"];
}
