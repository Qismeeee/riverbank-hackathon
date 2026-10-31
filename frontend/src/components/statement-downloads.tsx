"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { caseCode, errorText } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/toast";

const READING_KEYS = [
  "source",
  "document_ref",
  "submitted_by",
  "period_start",
  "period_end",
  "file",
  "extraction",
  "classifier",
  "coverage",
  "statement_lines",
  "marketplace_total",
  "platform_total",
  "difference",
  "matched",
  "message",
  "threshold_bps",
] as const;

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function uploadedStatement(
  runs: { statement: Record<string, unknown> | null }[],
): Record<string, unknown> | null {
  for (let index = runs.length - 1; index >= 0; index -= 1) {
    const statement = runs[index]?.statement;
    if (statement && statement.source === "uploaded_file") return statement;
  }
  return null;
}

function objectField(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || !(key in value)) return undefined;
  return (value as Record<string, unknown>)[key];
}

export function statementFacts(statement: Record<string, unknown>) {
  const pages = objectField(statement.file, "pages");
  const parser = objectField(statement.extraction, "parser");
  const mediaType = objectField(statement.file, "media_type");
  return {
    mediaType: typeof mediaType === "string" ? mediaType : null,
    pages: typeof pages === "number" ? pages : null,
    parser: typeof parser === "string" ? parser : null,
    lines: Array.isArray(statement.statement_lines) ? statement.statement_lines.length : null,
  };
}

export function statementStored(statement: Record<string, unknown> | null): boolean {
  const original = statement?.original;
  if (!original || typeof original !== "object") return false;
  const store = "store" in original ? original.store : undefined;
  return store === "local" || store === "s3";
}

type Props = {
  token: string;
  caseId: string;
  stored: boolean;
  mediaType?: string | null;
  pages?: number | null;
  parser?: string | null;
  lines?: number | null;
  statement?: Record<string, unknown> | null;
};

export function StatementDownloads({ token, caseId, stored, mediaType, pages, parser, lines, statement }: Props) {
  const { m } = useI18n();
  const [busy, setBusy] = useState<"" | "file" | "reading">("");
  const code = caseCode(caseId);
  const meta = [
    parser ? m.statement.parser(parser) : "",
    pages != null ? m.statement.pages(pages) : "",
    lines != null ? m.statement.lines(lines) : "",
    mediaType ?? "",
  ].filter(Boolean);

  async function downloadReading() {
    setBusy("reading");
    try {
      if (statement) {
        const payload: Record<string, unknown> = {};
        for (const key of READING_KEYS) {
          if (key in statement) payload[key] = statement[key];
        }
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        saveBlob(blob, `${code}-ket-qua-doc.json`);
      } else {
        const file = await api.download(token, `/v1/cases/${caseId}/statements/reading`);
        saveBlob(file.blob, file.name || `${code}-ket-qua-doc.json`);
      }
      toast(m.statement.readingSaved, "ok");
    } catch (err) {
      toast(errorText(err, m.errors, m.common.server), "err");
    } finally {
      setBusy("");
    }
  }

  async function downloadFile() {
    setBusy("file");
    try {
      const file = await api.download(token, `/v1/cases/${caseId}/statements/original`);
      saveBlob(file.blob, file.name || `${code}-sao-ke`);
      toast(m.statement.fileSaved, "ok");
    } catch (err) {
      toast(errorText(err, m.errors, m.common.server), "err");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h2 className="text-sm font-semibold text-slate-900">{m.statement.archiveTitle}</h2>
      <p className="mt-1 text-sm text-slate-600">{m.statement.archiveLead}</p>
      {meta.length ? <p className="mt-2 text-xs text-slate-500">{meta.join(" · ")}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!stored || busy !== ""}
          className="cursor-pointer rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => void downloadFile()}
        >
          {busy === "file" ? m.statement.downloading : m.statement.downloadFile}
        </button>
        <button
          type="button"
          disabled={busy !== ""}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors duration-200 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => void downloadReading()}
        >
          {busy === "reading" ? m.statement.downloading : m.statement.downloadReading}
        </button>
      </div>
      {stored ? null : <p className="mt-2 text-sm text-slate-600">{m.statement.fileMissing}</p>}
    </div>
  );
}
