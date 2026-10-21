"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createLeadPrototypeAction } from "@/src/app/actions/prototypes";
import type { LeadPrototypeOptionsDTO } from "@/src/server/prototypes/prototype.dto";
import { prototypeConfigurationSchema } from "./schemas/prototype-configuration.schema";
import { ConfigurationField, PrototypeConfigurationFields, configurationInputClass } from "./prototype-configuration-fields";

export function CreatePrototypeForm({ options }: { options: LeadPrototypeOptionsDTO }) {
  const { lead, templates, prototypes } = options;
  const [name, setName] = useState(`Protótipo · ${lead.name}`.slice(0, 120));
  const [templateId, setTemplateId] = useState(templates.length === 1 ? templates[0].id : "");
  const [createAnother, setCreateAnother] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [configuration, setConfiguration] = useState(() => structuredClone(options.configuration));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const lock = useRef(false);
  const router = useRouter();
  return <div className="mt-6 space-y-6">
    {prototypes.length > 0 && <section className="space-y-3 rounded-xl border border-sidebar-hover bg-card p-5" aria-label="Protótipos existentes">
      <h2 className="font-semibold">Este lead já possui {prototypes.length} {prototypes.length === 1 ? "protótipo" : "protótipos"}</h2>
      <ul className="space-y-2">{prototypes.map(prototype => <li key={prototype.id}>
        <Link className="text-sm text-primary underline" href={`/prototipos/${prototype.id}`}>Abrir {prototype.name}</Link>
      </li>)}</ul>
      {templates.length > 0 && <label className="flex items-center gap-3 text-sm"><input type="checkbox" disabled={pending} checked={createAnother} onChange={event => setCreateAnother(event.target.checked)} />Quero criar outro protótipo para este lead</label>}
    </section>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {!templates.length ? <p role="status" className="rounded-xl border border-sidebar-hover p-5 text-secundary">Ainda não há um template compatível com a categoria {lead.categoryName}. Os protótipos existentes continuam disponíveis.</p>
      : (!prototypes.length || createAnother) && <form noValidate className="space-y-6" onSubmit={async event => {
        event.preventDefault();
        if (lock.current) return;
        const parsed = prototypeConfigurationSchema.safeParse(configuration);
        const validationErrors: Record<string, string> = {};
        if (!parsed.success) for (const issue of parsed.error.issues) validationErrors[issue.path.join(".")] = issue.message;
        if (!name.trim()) validationErrors.name = "Informe um nome interno para o protótipo.";
        if (!templates.some(template => template.id === templateId)) validationErrors.templateId = "Selecione um template disponível.";
        setFieldErrors(validationErrors);
        if (Object.keys(validationErrors).length) {
          setError("Revise os campos indicados antes de criar o protótipo.");
          return;
        }
        lock.current = true; setPending(true); setError("");
        try {
          const result = await createLeadPrototypeAction({ name, configuration, leadId: lead.id, templateId, expectedPrototypeCount: prototypes.length, createAnother });
          if (!result.success) {
            setError(result.error);
            setFieldErrors(Object.fromEntries(Object.entries(result.fieldErrors ?? {}).map(([path, message]) => [path.replace(/^configuration\./, ""), message])));
            if (result.code === "CONFLICT") router.refresh();
            return;
          }
          router.push(`/prototipos/${result.data.id}`);
        } catch { setError("Não foi possível criar o protótipo. Tente novamente."); }
        finally { lock.current = false; setPending(false); }
      }}>
        <fieldset disabled={pending} className="space-y-6 disabled:opacity-75">
          <div className="grid gap-5 rounded-2xl border border-sidebar-hover bg-card p-5 sm:grid-cols-2 sm:p-6">
            <div className="sm:col-span-2"><ConfigurationField path="name" label="Nome interno do protótipo" required maxLength={120} value={name} errors={fieldErrors} onChange={setName} /></div>
            <div className="space-y-2"><label htmlFor="prototype-category" className="block text-sm font-medium">Categoria do lead</label><input id="prototype-category" readOnly className={configurationInputClass} value={lead.categoryName} /></div>
            <div className="space-y-2"><label htmlFor="prototype-template" className="block text-sm font-medium">Template</label><select id="prototype-template" required value={templateId} onChange={event => setTemplateId(event.target.value)} className={configurationInputClass} aria-invalid={Boolean(fieldErrors.templateId)} aria-describedby={fieldErrors.templateId ? "prototype-template-error" : undefined}>
              {templates.length > 1 && <option value="">Selecione um template</option>}{templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>{fieldErrors.templateId && <p id="prototype-template-error" className="text-xs text-red-300">{fieldErrors.templateId}</p>}</div>
          </div>
          <PrototypeConfigurationFields value={configuration} onChange={setConfiguration} errors={fieldErrors} />
          <section className="space-y-2 rounded-2xl border border-sidebar-hover bg-card p-5 sm:p-6">
            <h2 className="text-base font-semibold">Aparência inicial</h2>
            <p className="text-sm text-secundary">{templates.find(template => template.id === templateId)?.description ?? "Selecione um template para continuar."}</p>
            <p className="text-xs leading-relaxed text-secundary">O protótipo mantém o template completo, com produtos, preços, avaliações e imagens demonstrativos. Campos opcionais vazios mantêm os valores padrão. Você poderá revisar todo o conteúdo no editor.</p>
          </section>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-sidebar-hover pt-5">
            <p className="max-w-md text-xs leading-relaxed text-secundary">Estas informações personalizam somente o protótipo. O cadastro original do lead será mantido.</p>
            <button disabled={!templateId} className="min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-background disabled:opacity-50">{pending ? "Criando protótipo…" : createAnother ? "Criar outro protótipo" : "Criar protótipo"}</button>
          </div>
        </fieldset>
      </form>}
  </div>;
}
