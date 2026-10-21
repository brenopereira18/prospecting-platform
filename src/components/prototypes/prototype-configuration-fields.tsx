"use client";

import type { PrototypeConfiguration } from "./schemas/prototype-configuration.schema";

type Errors = Record<string, string>;
type FieldProps = {
  path: string; label: string; value: string; maxLength: number; errors: Errors;
  onChange: (value: string) => void; required?: boolean; multiline?: boolean; inputMode?: "text" | "tel" | "url";
};
export const configurationInputClass = "min-h-11 w-full rounded-lg border border-sidebar-hover bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

export function ConfigurationField({ path, label, value, errors, onChange, maxLength, required, multiline, inputMode = "text" }: FieldProps) {
  const id = `config-${path.replaceAll(".", "-")}`;
  const props = { id, value, maxLength, required, className: configurationInputClass,
    "aria-invalid": Boolean(errors[path]), "aria-describedby": errors[path] ? `${id}-error` : undefined,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value) };
  return <div className="space-y-2">
    <label htmlFor={id} className="block text-sm font-medium">{label}{!required && <span className="ml-1 font-normal text-secundary">(opcional)</span>}</label>
    {multiline ? <textarea {...props} rows={4} /> : <input {...props} type="text" inputMode={inputMode} />}
    {errors[path] && <p id={`${id}-error`} className="text-xs text-red-300">{errors[path]}</p>}
  </div>;
}

export function PrototypeConfigurationFields({ value, onChange, errors }: {
  value: PrototypeConfiguration; onChange: (value: PrototypeConfiguration) => void; errors: Errors;
}) {
  const contact = (field: keyof PrototypeConfiguration["contact"], label: string, maxLength: number, inputMode: "tel" | "url") => (
    <ConfigurationField key={field} path={`contact.${field}`} label={label} value={value.contact[field]} maxLength={maxLength} inputMode={inputMode} errors={errors}
      onChange={text => onChange({ ...value, contact: { ...value.contact, [field]: text } })} />
  );
  return <>
    <fieldset className="rounded-2xl border border-sidebar-hover bg-card p-5 sm:p-6">
      <legend className="px-2 text-base font-semibold">Identificação do estabelecimento</legend>
      <div className="space-y-5">
        <ConfigurationField path="businessName" label="Nome do estabelecimento" required maxLength={120} value={value.businessName} errors={errors} onChange={businessName => onChange({ ...value, businessName })} />
        <ConfigurationField path="tagline" label="Slogan principal" maxLength={160} value={value.tagline} errors={errors} onChange={tagline => onChange({ ...value, tagline })} />
        <ConfigurationField path="description" label="Descrição do estabelecimento" multiline maxLength={320} value={value.description} errors={errors} onChange={description => onChange({ ...value, description })} />
      </div>
    </fieldset>
    <fieldset className="rounded-2xl border border-sidebar-hover bg-card p-5 sm:p-6">
      <legend className="px-2 text-base font-semibold">Contato</legend>
      <div className="grid gap-5 sm:grid-cols-2">{contact("phone", "Telefone", 24, "tel")}{contact("whatsapp", "WhatsApp com DDD ou DDI", 24, "tel")}<div className="sm:col-span-2">{contact("instagramUrl", "Link do Instagram", 2048, "url")}</div></div>
      <p className="mt-4 text-xs leading-relaxed text-secundary">O telefone cadastrado não confirma a disponibilidade de WhatsApp. Preencha esse canal somente se ele for utilizado pelo estabelecimento.</p>
    </fieldset>
    <fieldset className="rounded-2xl border border-sidebar-hover bg-card p-5 sm:p-6">
      <legend className="px-2 text-base font-semibold">Localização</legend>
      <div className="grid gap-5 sm:grid-cols-2">
        {([["street", "Endereço", 160], ["neighborhood", "Bairro", 100], ["city", "Cidade", 100], ["state", "Estado / UF", 50]] as const).map(([field, label, maxLength]) => <div key={field} className={field === "street" ? "sm:col-span-2" : ""}>
          <ConfigurationField path={`address.${field}`} label={label} maxLength={maxLength} value={value.address[field]} errors={errors} onChange={text => onChange({ ...value, address: { ...value.address, [field]: text } })} />
        </div>)}
        <div className="sm:col-span-2">{contact("mapsUrl", "Link de localização", 2048, "url")}</div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-secundary">Informe um link para substituir o mapa padrão. Campos vazios mantêm os dados demonstrativos do template. O endereço do lead não é separado automaticamente em bairro, cidade ou estado.</p>
    </fieldset>
  </>;
}
