"use client";

import { FormEvent, useState } from "react";
import { Field, fieldClass } from "@/components/fields";
import { displayDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { StatementPeriod } from "@/lib/types";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["text/csv", "application/pdf", "image/png", "image/jpeg"]);

export function StatementUpload({
  tone,
  version,
  busy,
  period,
  onSubmit,
}: {
  tone: "brand" | "teal";
  version: number;
  busy: boolean;
  period?: StatementPeriod | null;
  onSubmit: (input: { periodStart: string; periodEnd: string; file: File }) => Promise<void>;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const { m } = useI18n();
  const [error, setError] = useState("");

  function onFile(next: File | null) {
    setFile(next);
    if (!next) {
      setError("");
      return;
    }
    const named = next.name.toLowerCase();
    const extensionOk = [".csv", ".pdf", ".png", ".jpg", ".jpeg"].some((ext) => named.endsWith(ext));
    if (!extensionOk && !ALLOWED.has(next.type)) {
      setError(m.statement.type);
      setFile(null);
      return;
    }
    if (next.size > MAX_BYTES) {
      setError(m.statement.size);
      setFile(null);
      return;
    }
    setError("");
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        const periodStart = period?.start || start;
        const periodEnd = period?.end || end;
        if (!periodStart || !periodEnd || periodEnd <= periodStart) {
          setError(m.statement.needDates);
          return;
        }
        if (!file) {
          setError(m.statement.choose);
          return;
        }
        setError("");
        void onSubmit({ periodStart, periodEnd, file }).catch(() => undefined);
      }}
    >
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{m.statement.title}</h3>
        <p className="mt-1 text-xs text-slate-600">{m.statement.version(version, version + 1)}</p>
      </div>
      {period ? (
        <p className="text-sm text-slate-700">{m.statement.periodLocked(displayDate(period.start), displayDate(period.end))}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={m.statement.start} htmlFor={`upload-start-${tone}`}>
            <input id={`upload-start-${tone}`} type="date" className={fieldClass(tone)} value={start} onChange={(event) => setStart(event.target.value)} required />
          </Field>
          <Field label={m.statement.end} htmlFor={`upload-end-${tone}`} error={start && end && end <= start ? m.statement.endAfter : undefined}>
            <input id={`upload-end-${tone}`} type="date" className={fieldClass(tone)} value={end} onChange={(event) => setEnd(event.target.value)} required />
          </Field>
        </div>
      )}
      <Field label={m.statement.file} htmlFor={`upload-file-${tone}`} hint={m.statement.fileHint} error={error || undefined}>
        <input
          id={`upload-file-${tone}`}
          type="file"
          accept=".csv,text/csv,.pdf,application/pdf,.png,image/png,.jpg,.jpeg,image/jpeg"
          className="mt-1.5 block w-full cursor-pointer text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800"
          onChange={(event) => onFile(event.target.files?.[0] ?? null)}
        />
      </Field>
      <button
        type="submit"
        disabled={busy || !file}
        className={`cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${tone === "teal" ? "bg-teal-700 hover:bg-teal-800" : "bg-brand-600 hover:bg-brand-700"}`}
      >
        {busy ? m.statement.running : m.statement.submit}
      </button>
    </form>
  );
}
