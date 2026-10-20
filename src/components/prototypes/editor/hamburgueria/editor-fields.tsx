"use client";

import type { Dispatch, ReactNode, ChangeEvent } from "react";
import type { HamburgueriaPrototypeDocument } from "../../templates/hamburgueria/schema/hamburgueria.schema";
import type { EditorDocumentAction, EditorErrors } from "./editor-document";

export interface PanelProps {
  document: HamburgueriaPrototypeDocument;
  dispatch: Dispatch<EditorDocumentAction>;
  errors: EditorErrors;
  onValidate: () => void;
}

export const inputClass = "min-h-10 w-full min-w-0 rounded-lg border border-sidebar-hover bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-secundary/60 focus:border-primary focus:ring-2 focus:ring-primary/15 aria-invalid:border-red-400";

export function fieldId(path: string) {
  return `editor-${path.replaceAll(".", "-")}`;
}

export function Field({ path, label, error, children }: {
  path: string; label: string; error?: string; children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={fieldId(path)} className="block text-xs font-medium text-foreground">{label}</label>
      {children}
      {error && <p id={`${fieldId(path)}-error`} className="text-xs leading-relaxed text-red-300">{error}</p>}
    </div>
  );
}

export function TextField({ path, label, value, onChange, multiline, inputMode, errors, onValidate }: {
  path: string; label: string; value: string; onChange: (value: string) => void;
  multiline?: boolean; inputMode?: "tel" | "url";
  errors: EditorErrors; onValidate: () => void;
}) {
  const props = {
    id: fieldId(path), value, className: inputClass,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
    onBlur: onValidate,
    "aria-invalid": Boolean(errors[path]),
    "aria-describedby": errors[path] ? `${fieldId(path)}-error` : undefined,
  };
  return (
    <Field path={path} label={label} error={errors[path]}>
      {multiline ? <textarea {...props} rows={2} /> : <input {...props} type="text" inputMode={inputMode} />}
    </Field>
  );
}
