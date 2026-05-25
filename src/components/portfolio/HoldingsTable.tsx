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
        className="max-w-sm rounded-lg border-[#1e2d40] bg-[#0a0f1e] text-sm text-white placeholder:text-[#4a5568] focus-visible:border-[#3b82f6]/60 focus-visible:ring-0"
        disabled={isLoading}
      />
      <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid #1e2d40" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="bg-[#0d1421]">Symbol</TableHead>
              <TableHead className="bg-[#0d1421] text-right">Qty</TableHead>
              <TableHead className="bg-[#0d1421] text-right">Avg Cost</TableHead>
              <TableHead className="bg-[#0d1421] text-right">LTP</TableHead>
              <TableHead
                className="cursor-pointer select-none bg-[#0d1421] text-right hover:bg-[#111827]"
                onClick={() => handleColumnSort("currentValue")}
              >
                Current Value{getSortIndicator("currentValue")}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none bg-[#0d1421] text-right hover:bg-[#111827]"
                onClick={() => handleColumnSort("unrealisedGain")}
              >
                P&amp;L (₹){getSortIndicator("unrealisedGain")}
              </TableHead>
              <TableHead className="bg-[#0d1421] text-right">P&amp;L (%)</TableHead>
              <TableHead
                className="cursor-pointer select-none bg-[#0d1421] text-right hover:bg-[#111827]"
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
                      <div className="h-5 w-full animate-pulse rounded bg-[#1a2235]" />
                    </TableCell>
                  </TableRow>
                ))
              : filteredAndSortedHoldings.map((holding) => (
                  <TableRow key={holding.symbol} className="hover:bg-[#1a2235]">
                    <TableCell className="font-mono font-medium text-white">
                      {holding.symbol}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {numberFormatter.format(holding.quantity)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {rupeeFormatter.format(holding.avgCost)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {rupeeFormatter.format(holding.currentPrice)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {rupeeFormatter.format(holding.currentValue)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono font-medium",
                        holding.unrealisedGain >= 0
                          ? "text-[color:var(--gain)]"
                          : "text-[color:var(--loss)]",
                      )}
                    >
                      {rupeeFormatter.format(holding.unrealisedGain)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono font-medium",
                        holding.unrealisedGain >= 0
                          ? "text-[color:var(--gain)]"
                          : "text-[color:var(--loss)]",
                      )}
                    >
                      {numberFormatter.format(holding.unrealisedGainPct)}%
                    </TableCell>
                    <TableCell className="text-right font-mono">
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
