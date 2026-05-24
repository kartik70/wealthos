"use client";

import { FileSpreadsheet, Upload, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ImportSource = "kite" | "groww";

interface KiteUploadResponse {
  snapshotId: string | null;
  warning?: string;
}

interface GrowwUploadResponse {
  mutualFundSnapshotId: string;
  warning?: string;
}

interface ImportPortfolioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ReplaceConfirmation {
  date: string;
  formData: FormData;
  source: ImportSource;
}

export function ImportPortfolioModal({
  open,
  onOpenChange,
}: ImportPortfolioModalProps) {
  const [kiteFile, setKiteFile] = useState<File | null>(null);
  const [growwFile, setGrowwFile] = useState<File | null>(null);
  const [reportDate, setReportDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [isUploading, setIsUploading] = useState(false);
  const [replaceConfirmation, setReplaceConfirmation] =
    useState<ReplaceConfirmation | null>(null);

  if (!open && replaceConfirmation === null) {
    return null;
  }

  if (replaceConfirmation !== null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={handleReplaceCancel}
          aria-label="Close confirmation"
        />

        <div className="relative z-10 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
          <h2 className="text-lg font-semibold tracking-tight">Replace snapshot?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A {replaceConfirmation.source === "kite" ? "portfolio" : "mutual fund"} snapshot
            for{" "}
            <span className="font-medium text-foreground">
              {replaceConfirmation.date}
            </span>{" "}
            already exists. Replace it with this file?
          </p>

          <div className="mt-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleReplaceCancel}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleReplaceConfirm} disabled={isUploading}>
              {isUploading ? "Replacing..." : "Replace"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  async function handleKiteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (kiteFile === null) {
      toast.error("Please select a CSV file");
      return;
    }

    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", kiteFile);
    formData.append("source", "kite");
    formData.append("reportDate", reportDate);

    await uploadPortfolio(formData, "kite", false);
  }

  async function handleGrowwSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (growwFile === null) {
      toast.error("Please select an XLSX file");
      return;
    }

    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", growwFile);
    formData.append("source", "groww");

    await uploadPortfolio(formData, "groww", false);
  }

  async function uploadPortfolio(
    formData: FormData,
    source: ImportSource,
    replace: boolean,
  ) {
    if (replace && !formData.has("replace")) {
      formData.append("replace", "true");
    }

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const payload: unknown = await response.json();

      if (!response.ok) {
        const message = getErrorMessage(payload);

        if (message.includes("already exists") && !replace) {
          const dateMatch = message.match(/for\s+(\d+\s+\w+\s+\d+)/);
          const displayDate = dateMatch ? dateMatch[1] : "this date";
          setReplaceConfirmation({
            date: displayDate,
            formData,
            source,
          });
          setIsUploading(false);
          return;
        }

        toast.error(message);
        setIsUploading(false);
        return;
      }

      if (!isValidUploadResponse(payload, source)) {
        toast.error("Upload succeeded but response format was invalid");
        setIsUploading(false);
        return;
      }

      if (payload.warning) {
        toast.warning(payload.warning);
      }

      toast.success(
        source === "kite"
          ? "Equity portfolio imported successfully"
          : "Mutual fund portfolio imported successfully",
      );
      window.dispatchEvent(new Event("wealthos:snapshot-updated"));
      onOpenChange(false);

      if (source === "kite") {
        setKiteFile(null);
      } else {
        setGrowwFile(null);
      }
    } catch {
      toast.error(
        source === "kite"
          ? "Failed to upload equity portfolio"
          : "Failed to upload mutual fund portfolio",
      );
    } finally {
      setIsUploading(false);
    }
  }

  function handleReplaceConfirm() {
    if (replaceConfirmation === null) {
      return;
    }

    const { formData, source } = replaceConfirmation;
    setReplaceConfirmation(null);
    setIsUploading(true);
    void uploadPortfolio(formData, source, true);
  }

  function handleReplaceCancel() {
    setReplaceConfirmation(null);
    setIsUploading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-label="Close import modal"
      />

      <div className="relative z-10 w-full max-w-lg rounded-xl border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Import Portfolio</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload Kite equity CSVs or Groww mutual fund XLSX exports.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <Tabs defaultValue="kite" className="gap-4">
          <TabsList className="w-full">
            <TabsTrigger value="kite">Kite Equity</TabsTrigger>
            <TabsTrigger value="groww">Groww MF</TabsTrigger>
          </TabsList>

          <TabsContent value="kite">
            <form onSubmit={handleKiteSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="portfolio-csv">CSV file</Label>
                <Input
                  id="portfolio-csv"
                  type="file"
                  accept=".csv,text/csv"
                  className="file:mr-3 file:rounded-md file:bg-muted file:px-2"
                  onChange={(event) => {
                    setKiteFile(event.target.files?.[0] ?? null);
                  }}
                />
              </div>

              <div className="grid gap-2 sm:max-w-48">
                <Label htmlFor="report-date">Report date</Label>
                <Input
                  id="report-date"
                  type="date"
                  value={reportDate}
                  onChange={(event) => {
                    setReportDate(event.target.value);
                  }}
                  className="h-8"
                />
              </div>

              <div>
                <Button type="submit" disabled={isUploading}>
                  <Upload data-icon="inline-start" aria-hidden="true" />
                  {isUploading ? "Importing..." : "Import CSV"}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="groww">
            <form onSubmit={handleGrowwSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="groww-xlsx">XLSX file</Label>
                <Input
                  id="groww-xlsx"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="file:mr-3 file:rounded-md file:bg-muted file:px-2"
                  onChange={(event) => {
                    setGrowwFile(event.target.files?.[0] ?? null);
                  }}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Snapshot date and totals are read from the file automatically.
              </p>

              <div>
                <Button type="submit" disabled={isUploading}>
                  <FileSpreadsheet data-icon="inline-start" aria-hidden="true" />
                  {isUploading ? "Importing..." : "Import XLSX"}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function getErrorMessage(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return "Upload failed";
}

function isValidUploadResponse(
  value: unknown,
  source: ImportSource,
): value is KiteUploadResponse | GrowwUploadResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<KiteUploadResponse & GrowwUploadResponse>;

  if (source === "kite") {
    return typeof candidate.snapshotId === "string" || candidate.snapshotId === null;
  }

  return typeof candidate.mutualFundSnapshotId === "string";
}
