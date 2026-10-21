"use client";

import type { PrototypeConfiguration } from "./schemas/prototype-configuration.schema";

type Errors = Record<string, string>;
type FieldProps = {
  path: string;
  label: string;
  value: string;
  maxLength: number;
  errors: Errors;
  onChange: (value: string) => void;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  inputMode?: "text" | "tel" | "url";
};
export const configurationInputClass =
  "min-h-11 w-full rounded-lg border border-sidebar-hover bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

export function ConfigurationField({
  path,
  label,
  value,
  errors,
  onChange,
  maxLength,
  required,
  multiline,
  rows = 4,
  hint,
  inputMode = "text",
}: FieldProps) {
  const id = `config-${path.replaceAll(".", "-")}`;
  const description =
    [hint && `${id}-hint`, errors[path] && `${id}-error`]
      .filter(Boolean)
      .join(" ") || undefined;
  const props = {
    id,
    value,
    maxLength,
    required,
    className: configurationInputClass,
    "aria-invalid": Boolean(errors[path]),
    "aria-describedby": description,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(event.target.value),
  };
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {!required && (
          <span className="ml-1 font-normal text-secundary">(opcional)</span>
        )}
      </label>
      {multiline ? (
        <textarea {...props} rows={rows} />
      ) : (
        <input {...props} type="text" inputMode={inputMode} />
      )}
      {hint && (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-secundary">
          {hint}
        </p>
      )}
      {errors[path] && (
        <p id={`${id}-error`} className="text-xs text-red-300">
          {errors[path]}
        </p>
      )}
    </div>
  );
}

type ConfigurationProps = {
  value: PrototypeConfiguration;
  onChange: (value: PrototypeConfiguration) => void;
  errors: Errors;
  templateId?: string;
};

function HamburgueriaServiceFields({
  value,
  onChange,
  errors,
}: ConfigurationProps) {
  const service = value.hamburgueria ?? {
    hoursSummary: "",
    deliveryRegion: "",
  };
  const update = (
    changes: Partial<NonNullable<PrototypeConfiguration["hamburgueria"]>>,
  ) => onChange({ ...value, hamburgueria: { ...service, ...changes } });
  const modesError = errors["hamburgueria.modes"];
  return (
    <details
      className="rounded-2xl border border-sidebar-hover bg-card p-5 sm:p-6"
      open={Boolean(
        service.modes || service.hoursSummary || service.deliveryRegion,
      )}
    >
      <summary className="cursor-pointer text-base font-semibold">
        Atendimento{" "}
        <span className="text-sm font-normal text-secundary">(opcional)</span>
      </summary>
      <div className="mt-5 space-y-5">
        <p className="text-xs leading-relaxed text-secundary">
          Preencha somente o que você conhece. O cardápio e as imagens mantêm os
          exemplos do template. Endereço, horários e avaliações aparecem após
          informação ou revisão; os demais detalhes podem ser refinados no
          editor.
        </p>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={Boolean(service.modes)}
            className="size-4 accent-primary"
            onChange={(event) =>
              update({
                modes: event.target.checked
                  ? { delivery: false, pickup: false, dineIn: false }
                  : undefined,
              })
            }
          />
          Personalizar modalidades de atendimento
        </label>
        {service.modes && (
          <fieldset
            aria-describedby={
              modesError ? "config-hamburgueria-modes-error" : undefined
            }
            className="space-y-2"
          >
            <legend className="mb-2 text-sm font-medium">
              Como o estabelecimento atende?
            </legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {(
                [
                  ["delivery", "Delivery"],
                  ["pickup", "Retirada"],
                  ["dineIn", "Consumo no local"],
                ] as const
              ).map(([field, label]) => (
                <label
                  key={field}
                  className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    id={`config-hamburgueria-modes-${field}`}
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={service.modes![field]}
                    aria-invalid={Boolean(modesError)}
                    onChange={(event) =>
                      update({
                        modes: {
                          ...service.modes!,
                          [field]: event.target.checked,
                        },
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            {modesError && (
              <p
                id="config-hamburgueria-modes-error"
                className="text-xs text-red-300"
              >
                {modesError}
              </p>
            )}
          </fieldset>
        )}
        <ConfigurationField
          path="hamburgueria.hoursSummary"
          label="Resumo do funcionamento"
          value={service.hoursSummary}
          errors={errors}
          maxLength={100}
          hint="Ex.: terça a domingo, das 18h às 23h. Aparece na abertura, na localização e no rodapé. Horários detalhados podem ser ajustados no editor."
          onChange={(hoursSummary) => update({ hoursSummary })}
        />
        {service.modes?.delivery && (
          <ConfigurationField
            path="hamburgueria.deliveryRegion"
            label="Região de entrega"
            value={service.deliveryRegion}
            errors={errors}
            maxLength={240}
            hint="Informe bairros ou uma região. Este campo não define taxas nem prazos de entrega."
            onChange={(deliveryRegion) => update({ deliveryRegion })}
          />
        )}
      </div>
    </details>
  );
}

export function PrototypeConfigurationFields({
  value,
  onChange,
  errors,
  templateId,
}: ConfigurationProps) {
  const contact = (
    field: keyof PrototypeConfiguration["contact"],
    label: string,
    maxLength: number,
    inputMode: "tel" | "url",
  ) => (
    <ConfigurationField
      key={field}
      path={`contact.${field}`}
      label={label}
      value={value.contact[field]}
      maxLength={maxLength}
      inputMode={inputMode}
      errors={errors}
      onChange={(text) =>
        onChange({ ...value, contact: { ...value.contact, [field]: text } })
      }
    />
  );
  return (
    <>
      <fieldset className="rounded-2xl border border-sidebar-hover bg-card p-5 sm:p-6">
        <legend className="px-2 text-base font-semibold">
          Estabelecimento e apresentação
        </legend>
        <div className="space-y-5">
          <ConfigurationField
            path="businessName"
            label="Nome do estabelecimento"
            required
            maxLength={120}
            value={value.businessName}
            errors={errors}
            onChange={(businessName) => onChange({ ...value, businessName })}
          />
          <ConfigurationField
            path="headline"
            label="Chamada principal da página"
            multiline
            rows={2}
            maxLength={121}
            value={value.headline}
            errors={errors}
            hint="Título da abertura. Use até duas linhas, com no máximo 60 caracteres em cada uma. Em branco, mantém o título do template."
            onChange={(headline) => onChange({ ...value, headline })}
          />
          <ConfigurationField
            path="description"
            label="Descrição curta do estabelecimento"
            multiline
            rows={3}
            maxLength={320}
            value={value.description}
            errors={errors}
            hint="Utilizada na abertura, na apresentação da localização e na descrição para buscadores."
            onChange={(description) => onChange({ ...value, description })}
          />
          <details open={Boolean(value.tagline)} className="space-y-3">
            <summary className="cursor-pointer text-sm font-medium">
              Slogan da marca
            </summary>
            <ConfigurationField
              path="tagline"
              label="Slogan da marca — exibido no rodapé"
              maxLength={160}
              value={value.tagline}
              errors={errors}
              onChange={(tagline) => onChange({ ...value, tagline })}
            />
          </details>
        </div>
      </fieldset>
      {templateId === "brasa-burger" && (
        <HamburgueriaServiceFields {...{ value, onChange, errors }} />
      )}
      <fieldset className="rounded-2xl border border-sidebar-hover bg-card p-5 sm:p-6">
        <legend className="px-2 text-base font-semibold">Contato</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          {contact("phone", "Telefone", 24, "tel")}
          {contact("whatsapp", "WhatsApp com DDD ou DDI", 24, "tel")}
          <div className="sm:col-span-2">
            {contact("instagramUrl", "Link do Instagram", 2048, "url")}
          </div>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-secundary">
          O telefone fica registrado no documento; os pedidos utilizam o
          WhatsApp informado. Um telefone cadastrado não confirma WhatsApp.
          Nesta demonstração, o link do Instagram abre um aviso e pode ser
          revisado no editor.
        </p>
      </fieldset>
      <fieldset className="rounded-2xl border border-sidebar-hover bg-card p-5 sm:p-6">
        <legend className="px-2 text-base font-semibold">Localização</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          {(
            [
              ["street", "Endereço", 160],
              ["neighborhood", "Bairro", 100],
              ["city", "Cidade", 100],
              ["state", "Estado / UF", 50],
            ] as const
          ).map(([field, label, maxLength]) => (
            <div
              key={field}
              className={field === "street" ? "sm:col-span-2" : ""}
            >
              <ConfigurationField
                path={`address.${field}`}
                label={label}
                maxLength={maxLength}
                value={value.address[field]}
                errors={errors}
                onChange={(text) =>
                  onChange({
                    ...value,
                    address: { ...value.address, [field]: text },
                  })
                }
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            {contact("mapsUrl", "Link de localização", 2048, "url")}
          </div>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-secundary">
          O link altera o destino do botão de localização; o mapa da página
          continua ilustrativo. Campos vazios mantêm os exemplos do template. O
          endereço do lead não é separado automaticamente em bairro, cidade ou
          estado.
        </p>
      </fieldset>
    </>
  );
}
