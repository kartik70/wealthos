export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { backfillHardcodedSectorsOnStartup } = await import("@/lib/finance/sectors");

  await backfillHardcodedSectorsOnStartup();
}
