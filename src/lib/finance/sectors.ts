import type { Holding, SectorAllocation } from "@/types/portfolio";
import type { Database } from "@/types/db";
import {
  buildSectorAllocations,
  DEFAULT_SECTOR,
  getHardcodedSectorForSymbol,
  normalizeSector,
  normalizeSymbol,
  SYMBOL_TO_SECTOR,
} from "./sector-map";

type SymbolSectorInsert = Database["public"]["Tables"]["symbol_sectors"]["Insert"];

let seedPromise: Promise<void> | null = null;

export async function backfillHardcodedSectorsOnStartup(): Promise<void> {
  await ensureHardcodedSectorsBackfilled();
}

export async function classifySectors(
  holdings: Holding[],
  aiApiKey?: string,
): Promise<SectorAllocation[]> {
  await ensureHardcodedSectorsBackfilled();

  const uniqueSymbols = Array.from(
    new Set(holdings.map((holding) => normalizeSymbol(holding.symbol))),
  ).filter((symbol) => symbol !== "");
  const sectorsBySymbol = await getSectorsForSymbols(uniqueSymbols, aiApiKey);

  return buildSectorAllocations(
    holdings,
    (symbol) => sectorsBySymbol.get(normalizeSymbol(symbol)) ?? DEFAULT_SECTOR,
  );
}

async function ensureHardcodedSectorsBackfilled(): Promise<void> {
  seedPromise ??= backfillHardcodedSectorsIfEmpty();
  await seedPromise;
}

async function backfillHardcodedSectorsIfEmpty(): Promise<void> {
  const { createSupabaseAdminClient } = await import("@/lib/db/supabase");
  const supabase = createSupabaseAdminClient();
  const { count, error: countError } = await supabase
    .from("symbol_sectors")
    .select("symbol", { count: "exact", head: true });

  if (countError !== null) {
    throw new Error(`Failed to check symbol sector cache: ${countError.message}`);
  }

  if ((count ?? 0) > 0) {
    return;
  }

  const rows: SymbolSectorInsert[] = Array.from(SYMBOL_TO_SECTOR.entries()).map(
    ([symbol, sector]) => ({
      symbol,
      sector,
      classified_by: "hardcoded",
    }),
  );

  const { error: upsertError } = await supabase
    .from("symbol_sectors")
    .upsert(rows, { onConflict: "symbol" });

  if (upsertError !== null) {
    throw new Error(`Failed to seed hardcoded sector cache: ${upsertError.message}`);
  }
}

async function getSectorsForSymbols(
  symbols: string[],
  aiApiKey?: string,
): Promise<Map<string, string>> {
  const sectorsBySymbol = new Map<string, string>();
  const { createSupabaseAdminClient } = await import("@/lib/db/supabase");
  const supabase = createSupabaseAdminClient();

  if (symbols.length === 0) {
    return sectorsBySymbol;
  }

  const { data, error } = await supabase
    .from("symbol_sectors")
    .select("symbol,sector")
    .in("symbol", symbols);

  if (error !== null) {
    throw new Error(`Failed to read symbol sector cache: ${error.message}`);
  }

  for (const row of data ?? []) {
    sectorsBySymbol.set(normalizeSymbol(row.symbol), normalizeSector(row.sector));
  }

  for (const symbol of symbols) {
    if (sectorsBySymbol.has(symbol)) {
      continue;
    }

    const hardcodedSector = getHardcodedSectorForSymbol(symbol);
    const sector =
      hardcodedSector === null
        ? await classifyAndCacheAISector(symbol, aiApiKey)
        : await cacheHardcodedSector(symbol, hardcodedSector);
    sectorsBySymbol.set(symbol, sector);
  }

  return sectorsBySymbol;
}

async function cacheHardcodedSector(symbol: string, sector: string): Promise<string> {
  const normalizedSector = normalizeSector(sector);
  const { createSupabaseAdminClient } = await import("@/lib/db/supabase");
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("symbol_sectors").upsert(
    {
      symbol,
      sector: normalizedSector,
      classified_by: "hardcoded",
    },
    { onConflict: "symbol" },
  );

  if (error !== null) {
    throw new Error(`Failed to cache hardcoded sector for ${symbol}: ${error.message}`);
  }

  return normalizedSector;
}

async function classifyAndCacheAISector(symbol: string, apiKey?: string): Promise<string> {
  const { classifyIndianStockSector } = await import("@/lib/ai/client");
  const sector = normalizeSector(await classifyIndianStockSector(symbol, apiKey));
  const { createSupabaseAdminClient } = await import("@/lib/db/supabase");
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("symbol_sectors").upsert(
    {
      symbol,
      sector,
      classified_by: "ai",
    },
    { onConflict: "symbol" },
  );

  if (error !== null) {
    throw new Error(`Failed to cache AI sector for ${symbol}: ${error.message}`);
  }

  return sector;
}
