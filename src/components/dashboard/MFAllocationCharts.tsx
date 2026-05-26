"use client";

import { useMemo, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
} from "recharts";

import type { MutualFundHolding } from "@/types/portfolio";

interface MFAllocationChartsProps {
  holdings: MutualFundHolding[];
}

interface DonutDatum {
  label: string;
  allocationPct: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DonutDatum; value: number }>;
}

interface ActiveShapeProps {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fill: string;
  payload: DonutDatum;
  value: number;
}

const chartColors = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#f43f5e",
  "#84cc16",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
];

export function MFAllocationCharts({ holdings }: MFAllocationChartsProps) {
  const byFund = useMemo(() => buildFundData(holdings), [holdings]);
  const byCategory = useMemo(() => buildCategoryData(holdings), [holdings]);

  return (
    <div className="flex flex-col gap-4">
      <DonutChart
        data={byFund}
        centerCount={holdings.length}
        centerLabel="FUNDS"
        sectionLabel="By Fund"
      />
      <DonutChart
        data={byCategory}
        centerCount={byCategory.length}
        centerLabel="CATEGORIES"
        sectionLabel="By Category"
      />
    </div>
  );
}

interface DonutChartProps {
  data: DonutDatum[];
  centerCount: number;
  centerLabel: string;
  sectionLabel: string;
}

function DonutChart({
  data,
  centerCount,
  centerLabel,
  sectionLabel,
}: DonutChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No {sectionLabel.toLowerCase()} data
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.15em] text-[#4a5568]">
        {sectionLabel}
      </div>
      <div className="relative h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="allocationPct"
              nameKey="label"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              isAnimationActive={true}
              animationBegin={0}
              animationDuration={800}
              animationEasing="ease-out"
              activeShape={renderActiveShape}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.label}
                  fill={chartColors[index % chartColors.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {activeIndex === null && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-lg text-[var(--text-primary)]">
              {centerCount}
            </span>
            <span className="mt-1 text-[10px] tracking-widest text-[#4a5568]">
              {centerLabel}
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {data.map((entry, index) => (
          <div
            key={entry.label}
            className="flex items-center gap-1.5 font-mono text-xs text-[#8899aa]"
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: chartColors[index % chartColors.length] }}
            />
            <span className="max-w-[160px] truncate" title={entry.label}>
              {entry.label}
            </span>
            <span>{entry.allocationPct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderActiveShape(props: unknown) {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    value,
  } = props as ActiveShapeProps;
  return (
    <g>
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fill="var(--text-primary)"
        className="font-mono text-[11px] font-medium"
      >
        {truncateLabel(payload.label, 18)}
      </text>
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        fill="var(--text-secondary)"
        className="font-mono text-xs"
      >
        {value.toFixed(1)}%
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={innerRadius - 2}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length > 0) {
    const datum = payload[0].payload;
    const value = payload[0].value;
    return (
      <div
        className="rounded-md p-2 text-xs"
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
        }}
      >
        <p className="font-mono font-medium">
          {datum.label}: {Number.isFinite(value) ? value.toFixed(2) : 0}%
        </p>
      </div>
    );
  }
  return null;
}

function buildFundData(holdings: MutualFundHolding[]): DonutDatum[] {
  const sorted = [...holdings].sort(
    (a, b) => b.allocationPct - a.allocationPct,
  );
  const top = sorted.slice(0, 8).map((h) => ({
    label: h.schemeName,
    allocationPct: h.allocationPct,
  }));
  const othersPct = sorted
    .slice(8)
    .reduce((sum, h) => sum + h.allocationPct, 0);
  if (othersPct > 0) {
    top.push({ label: "Others", allocationPct: othersPct });
  }
  return top;
}

function buildCategoryData(holdings: MutualFundHolding[]): DonutDatum[] {
  const totals = new Map<string, number>();
  for (const h of holdings) {
    const key = h.category && h.category.trim().length > 0 ? h.category : "Uncategorised";
    totals.set(key, (totals.get(key) ?? 0) + h.allocationPct);
  }
  return Array.from(totals.entries())
    .map(([label, allocationPct]) => ({ label, allocationPct }))
    .sort((a, b) => b.allocationPct - a.allocationPct);
}

function truncateLabel(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
