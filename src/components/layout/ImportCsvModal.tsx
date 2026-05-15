"use client";

import { Upload, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UploadResponse {
  snapshotId: string | null;
  warning?: string;
}

interface ImportCsvModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportCsvModal({ open, onOpenChange }: ImportCsvModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<"kite" | "groww">("kite");
  const [reportDate, setReportDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [isUploading, setIsUploading] = useState(false);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (file === null) {
      toast.error("Please select a CSV file");
      return;
    }

    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("source", source);
    formData.append("reportDate", reportDate);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const payload: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "Upload failed";

        toast.error(message);
        return;
      }

      if (!isUploadResponse(payload)) {
        toast.error("Upload succeeded but response format was invalid");
        return;
      }

      if (payload.warning) {
        toast.warning(payload.warning);
      }

      toast.success("Portfolio imported successfully");
      window.dispatchEvent(new Event("wealthos:snapshot-updated"));
      onOpenChange(false);
      setFile(null);
    } catch {
      toast.error("Failed to upload portfolio");
    } finally {
      setIsUploading(false);
    }
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
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Import CSV</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload your latest Kite or Groww statement.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="portfolio-csv">CSV file</Label>
            <Input
              id="portfolio-csv"
              type="file"
              accept=".csv,text/csv"
              className="file:mr-3 file:rounded-md file:bg-muted file:px-2"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
              }}
            />
          </div>

          <div className="grid gap-2 sm:max-w-48">
            <Label htmlFor="source">Source</Label>
            <select
              id="source"
              value={source}
              onChange={(event) => {
                setSource(event.target.value === "groww" ? "groww" : "kite");
              }}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="kite">Kite</option>
              <option value="groww">Groww</option>
            </select>
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
              <Upload className="size-4" aria-hidden="true" />
              {isUploading ? "Importing..." : "Import CSV"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function isUploadResponse(value: unknown): value is UploadResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<UploadResponse>;

  return typeof candidate.snapshotId === "string" || candidate.snapshotId === null;
}
