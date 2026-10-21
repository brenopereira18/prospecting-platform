"use client";

import {
  Field,
  TextField,
  fieldId,
  inputClass,
  type PanelProps,
} from "./editor-fields";
import {
  getSectionField,
  sectionField,
  type SectionTextPath,
} from "./editor-section-document";

type TextControls = ReadonlyArray<readonly [SectionTextPath, string, boolean?]>;

export function SectionTextFields({
  fields,
  ...props
}: PanelProps & { fields: TextControls }) {
  return (
    <div className="space-y-4">
      {fields.map(([path, label, multiline]) => (
        <TextField
          key={path}
          path={path}
          label={label}
          multiline={multiline}
          value={getSectionField(props.document, path) ?? ""}
          errors={props.errors}
          onValidate={props.onValidate}
          onChange={(value) => props.dispatch(sectionField(path, value))}
        />
      ))}
    </div>
  );
}

export function EditorSelect({
  path,
  label,
  value,
  options,
  onChange,
  errors,
  onValidate,
}: {
  path: string;
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
  errors: PanelProps["errors"];
  onValidate: () => void;
}) {
  return (
    <Field path={path} label={label} error={errors[path]}>
      <select
        id={fieldId(path)}
        className={inputClass}
        value={value}
        onBlur={onValidate}
        aria-invalid={Boolean(errors[path])}
        aria-describedby={errors[path] ? `${fieldId(path)}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function EditorCheck({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 accent-primary"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
