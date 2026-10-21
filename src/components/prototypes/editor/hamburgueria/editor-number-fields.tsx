"use client";

import { useState } from "react";
import { Field, fieldId, inputClass, type PanelProps } from "./editor-fields";
import { formatEditableReais, parseReais } from "./editor-menu-document";

export function PriceField({ path, cents, onChange, errors, onValidate, label = "Preço (R$)" }: {
  path: string; cents: number; onChange: (cents: number) => void;
  errors: PanelProps["errors"]; onValidate: () => void; label?: string;
}) {
  // Only the unfinished input is local. Every valid price goes into the document.
  const [draft, setDraft] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);
  const invalid = draft !== null && parseReais(draft) === null;
  const error = invalid ? "Informe um preço entre R$ 0,00 e R$ 1.000.000,00, com até duas casas decimais."
    : rejected ? "Preço inválido. O último valor válido foi mantido." : errors[path];
  return (
    <Field path={path} label={label} error={error}>
      <input id={fieldId(path)} className={inputClass} type="text" inputMode="decimal"
        value={draft ?? formatEditableReais(cents)} aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId(path)}-error` : undefined}
        onFocus={() => setRejected(false)}
        onChange={event => {
          const value = event.target.value;
          setDraft(value);
          setRejected(false);
          const parsed = parseReais(value);
          if (parsed !== null) onChange(parsed);
        }}
        onBlur={() => {
          setRejected(invalid);
          setDraft(null);
          onValidate();
        }} />
    </Field>
  );
}
export function NumberField({ path, label, value, min, max, integer = false, onChange, errors, onValidate }: {
  path: string; label: string; value: number | undefined; min: number; max: number; integer?: boolean;
  onChange: (value: number) => void; errors: PanelProps["errors"]; onValidate: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);
  const parsed = draft?.trim() ? Number(draft.replace(",", ".")) : NaN;
  const invalid = draft !== null && (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed)));
  const error = invalid || rejected ? `Informe ${integer ? "um número inteiro" : "um número"} entre ${min} e ${max}.` : errors[path];
  return (
    <Field path={path} label={label} error={error}>
      <input id={fieldId(path)} className={inputClass} type="text" inputMode={integer ? "numeric" : "decimal"}
        value={draft ?? (value === undefined ? "" : String(value))} aria-invalid={Boolean(error)} aria-describedby={error ? `${fieldId(path)}-error` : undefined}
        onFocus={() => setRejected(false)} onChange={event => {
          const raw = event.target.value;
          setDraft(raw); setRejected(false);
          const number = raw.trim() ? Number(raw.replace(",", ".")) : NaN;
          if (Number.isFinite(number) && number >= min && number <= max && (!integer || Number.isInteger(number))) onChange(number);
        }} onBlur={() => { setRejected(invalid); setDraft(null); onValidate(); }} />
    </Field>
  );
}

