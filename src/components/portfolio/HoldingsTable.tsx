"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Holding } from "@/types/portfolio";

interface HoldingsTableProps {
  holdings: Holding[];
}

const rupeeFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Symbol</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Avg Cost</TableHead>
          <TableHead className="text-right">LTP</TableHead>
          <TableHead className="text-right">Current Value</TableHead>
          <TableHead className="text-right">P&amp;L (₹)</TableHead>
          <TableHead className="text-right">P&amp;L (%)</TableHead>
          <TableHead className="text-right">Allocation %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {holdings.map((holding) => (
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
                holding.unrealisedGain >= 0 ? "text-emerald-700" : "text-red-700",
              )}
            >
              {rupeeFormatter.format(holding.unrealisedGain)}
            </TableCell>
            <TableCell
              className={cn(
                "text-right font-medium",
                holding.unrealisedGain >= 0 ? "text-emerald-700" : "text-red-700",
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
  );
}
