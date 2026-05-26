"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";

import { importCsvHistory } from "@/lib/actions/csv-import";

interface CsvImportPanelProps {
  accountId: string;
}

/**
 * Inline CSV import for an account detail page. Paste Scotiabank export
 * text → snapshot rows backfilled for the chart. Generic fallback if
 * the CSV has Date + Balance columns under any header name.
 */
export function CsvImportPanel({ accountId }: CsvImportPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setResult(null);
    startTransition(async () => {
      try {
        const { imported } = await importCsvHistory({ accountId, csvText });
        setResult(`Imported ${imported} balance snapshot${imported === 1 ? "" : "s"}.`);
        setCsvText("");
        router.refresh();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Import failed");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-primary underline-offset-4 hover:underline"
      >
        <FileText className="h-3 w-3" />
        Import history from a CSV
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-card border border-text-primary/10 bg-bg-tertiary p-4"
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
        Paste CSV from your bank
      </div>
      <p className="text-[11px] leading-relaxed text-text-muted">
        Paste a Scotiabank Account History export — we read the Date and
        Balance columns and backfill the chart. Works with any CSV that has
        those two columns under those header names.
      </p>
      <textarea
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        rows={6}
        placeholder='"Date","Description",...,"Balance"'
        className="w-full resize-none rounded-md border border-text-primary/12 bg-bg-primary p-3 font-mono text-[11px] leading-relaxed text-text-primary placeholder:text-text-muted focus:border-accent-primary/40 focus:outline-none focus:ring-2 focus:ring-accent-primary/15"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setCsvText("");
            setResult(null);
            setErrorMsg(null);
          }}
          disabled={pending}
          className="flex-1 rounded-full border border-text-primary/15 bg-bg-tertiary py-2.5 text-xs font-semibold text-text-primary transition hover:bg-bg-secondary disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !csvText.trim()}
          className="flex-1 rounded-full bg-accent-primary py-2.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Importing…" : "Import"}
        </button>
      </div>
      {result && (
        <p className="text-center text-xs font-semibold text-positive">
          {result}
        </p>
      )}
      {errorMsg && (
        <p className="text-center text-xs text-negative">{errorMsg}</p>
      )}
    </form>
  );
}
