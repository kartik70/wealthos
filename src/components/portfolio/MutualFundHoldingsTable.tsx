"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { MutualFundHolding } from "@/types/portfolio";

interface MutualFundHoldingsTableProps {
  holdings: MutualFundHolding[];
  isLoading?: boolean;
  skeletonRows?: number;
}

type SortColumn = "currentValue" | "returns" | "allocationPct" | null;
type SortDirection = "asc" | "desc";

const rupeeFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});

export function MutualFundHoldingsTable({
  holdings,
  isLoading = false,
  skeletonRows = 8,
}: MutualFundHoldingsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const filteredAndSortedHoldings = useMemo(() => {
    let result = holdings;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (holding) =>
          holding.schemeName.toLowerCase().includes(query) ||
          holding.amc.toLowerCase().includes(query) ||
          holding.category.toLowerCase().includes(query),
      );
    }

    if (sortColumn) {
      result = [...result].sort((left, right) => {
        const leftValue = left[sortColumn];
        const rightValue = right[sortColumn];
        const delta = leftValue - rightValue;
        return sortDirection === "asc" ? delta : -delta;
      });
    }

    return result;
  }, [holdings, searchQuery, sortColumn, sortDirection]);

  function toggleSort(column: SortColumn) {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection("desc");
      return;
    }

    setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-full max-w-sm animate-pulse rounded bg-muted" />
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: 6 }, (_, index) => (
                <TableHead key={index}>
                  <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: skeletonRows }, (_, rowIndex) => (
              <TableRow key={rowIndex}>
                {Array.from({ length: 6 }, (_, cellIndex) => (
                  <TableCell key={cellIndex}>
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search scheme, AMC, or category..."
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        className="max-w-sm"
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Scheme</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Units</TableHead>
            <SortableHead
              label="Current value"
              active={sortColumn === "currentValue"}
              direction={sortDirection}
              onClick={() => toggleSort("currentValue")}
            />
            <SortableHead
              label="Returns"
              active={sortColumn === "returns"}
              direction={sortDirection}
              onClick={() => toggleSort("returns")}
            />
            <SortableHead
              label="Allocation"
              active={sortColumn === "allocationPct"}
              direction={sortDirection}
              onClick={() => toggleSort("allocationPct")}
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAndSortedHoldings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                No mutual fund holdings match your search.
              </TableCell>
            </TableRow>
          ) : (
            filteredAndSortedHoldings.map((holding) => (
              <TableRow key={`${holding.folioNo}-${holding.schemeName}`}>
                <TableCell>
                  <div className="font-medium">{holding.schemeName}</div>
                  <div className="text-xs text-muted-foreground">{holding.amc}</div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {holding.category}
                  {holding.subCategory ? ` · ${holding.subCategory}` : ""}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {numberFormatter.format(holding.units)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {rupeeFormatter.format(holding.currentValue)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono text-sm",
                    holding.returns >= 0 ? "text-[color:var(--gain)]" : "text-[color:var(--loss)]",
                  )}
                >
                  {rupeeFormatter.format(holding.returns)} (
                  {numberFormatter.format(holding.returnsPct)}%)
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {numberFormatter.format(holding.allocationPct)}%
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function SortableHead({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <TableHead className="text-right">
      <button
        type="button"
        onClick={onClick}
        className="ml-auto flex items-center gap-1 font-medium hover:text-foreground"
      >
        {label}
        {active ? <span className="text-xs">{direction === "asc" ? "↑" : "↓"}</span> : null}
      </button>
    </TableHead>
  );
}
