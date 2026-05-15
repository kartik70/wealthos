"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Holding } from "@/types/portfolio";

interface HoldingsTableProps {
  holdings: Holding[];
  isLoading?: boolean;
  skeletonRows?: number;
}

type SortColumn = "currentValue" | "unrealisedGain" | "allocationPct" | null;
type SortDirection = "asc" | "desc";

const rupeeFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});

export function HoldingsTable({
  holdings,
  isLoading = false,
  skeletonRows = 8,
}: HoldingsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const filteredAndSortedHoldings = useMemo(() => {
    let result = holdings;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (holding) =>
          holding.symbol.toLowerCase().includes(query) ||
          holding.name.toLowerCase().includes(query),
      );
    }

    // Apply sorting
    if (sortColumn) {
      result = [...result].sort((a, b) => {
        let aValue: number;
        let bValue: number;

        switch (sortColumn) {
          case "currentValue":
            aValue = a.currentValue;
            bValue = b.currentValue;
            break;
          case "unrealisedGain":
            aValue = a.unrealisedGain;
            bValue = b.unrealisedGain;
            break;
          case "allocationPct":
            aValue = a.allocationPct;
            bValue = b.allocationPct;
            break;
          default:
            return 0;
        }

        if (sortDirection === "asc") {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      });
    }

    return result;
  }, [holdings, searchQuery, sortColumn, sortDirection]);

  const handleColumnSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if same column clicked
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New column - start with ascending
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return "";
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by symbol or name..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="max-w-sm"
        disabled={isLoading}
      />
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Avg Cost</TableHead>
              <TableHead className="text-right">LTP</TableHead>
              <TableHead
                className="cursor-pointer select-none text-right hover:bg-muted"
                onClick={() => handleColumnSort("currentValue")}
              >
                Current Value{getSortIndicator("currentValue")}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-right hover:bg-muted"
                onClick={() => handleColumnSort("unrealisedGain")}
              >
                P&amp;L (₹){getSortIndicator("unrealisedGain")}
              </TableHead>
              <TableHead className="text-right">P&amp;L (%)</TableHead>
              <TableHead
                className="cursor-pointer select-none text-right hover:bg-muted"
                onClick={() => handleColumnSort("allocationPct")}
              >
                Allocation %{getSortIndicator("allocationPct")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: skeletonRows }, (_, index) => (
                  <TableRow key={`skeleton-${index}`}>
                    <TableCell colSpan={8}>
                      <div className="h-5 w-full animate-pulse rounded bg-muted" />
                    </TableCell>
                  </TableRow>
                ))
              : filteredAndSortedHoldings.map((holding) => (
                  <TableRow key={holding.symbol}>
                    <TableCell className="font-medium">{holding.symbol}</TableCell>
                    <TableCell className="text-right">
                      {numberFormatter.format(holding.quantity)}
                    </TableCell>
                    <TableCell className="text-right">
                      {rupeeFormatter.format(holding.avgCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      {rupeeFormatter.format(holding.currentPrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      {rupeeFormatter.format(holding.currentValue)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium",
                        holding.unrealisedGain >= 0
                          ? "text-emerald-700"
                          : "text-red-700",
                      )}
                    >
                      {rupeeFormatter.format(holding.unrealisedGain)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium",
                        holding.unrealisedGain >= 0
                          ? "text-emerald-700"
                          : "text-red-700",
                      )}
                    >
                      {numberFormatter.format(holding.unrealisedGainPct)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {numberFormatter.format(holding.allocationPct)}%
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
