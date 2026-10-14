"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy, FileText } from "lucide-react";

import type { ApproachTemplateDTO } from "../../server/approach-templates/approach-template.dto";

interface LeadApproachProps {
  leadName: string;
  userName: string;
  templates: ApproachTemplateDTO[];
}

function renderTemplate(
  content: string,
  leadName: string,
  userName: string,
): string {
  return content
    .replaceAll("{{nome}}", leadName)
    .replaceAll("{{nome_do_usuario}}", userName);
}

export function LeadApproach({
  leadName,
  userName,
  templates,
}: LeadApproachProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    templates[0]?.id ?? "",
  );

  const [editedMessages, setEditedMessages] = useState<Record<string, string>>(
    {},
  );

  const [copied, setCopied] = useState(false);

  const selectedTemplate = templates.find(
    (template) => template.id === selectedTemplateId,
  );

  const message = selectedTemplate
    ? (editedMessages[selectedTemplate.id] ??
      renderTemplate(selectedTemplate.content, leadName, userName))
    : "";

  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);
    setCopied(false);
  }

  function handleMessageChange(value: string) {
    if (!selectedTemplate) return;

    setEditedMessages((previous) => ({
      ...previous,
      [selectedTemplate.id]: value,
    }));

    setCopied(false);
  }

  async function handleCopy() {
    if (!message.trim()) return;

    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (templates.length === 0) {
    return (
      <section aria-labelledby="approach-title" className="space-y-6">
        <div>
          <h2
            id="approach-title"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            Abordagem comercial
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-secundary">
            Prepare uma mensagem para iniciar a conversa com este negócio.
          </p>
        </div>
        <div className="flex items-start gap-4 rounded-2xl border border-dashed border-sidebar-hover bg-terciary/40 p-6 sm:p-8">
          <FileText
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-secundary"
          />
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-foreground">
              Nenhum modelo disponível
            </h3>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-secundary">
              Ainda não há mensagens cadastradas para a categoria deste
              estabelecimento. Quando houver um modelo, você poderá
              personalizá-lo aqui.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="approach-title" className="space-y-6">
      <div className="max-w-2xl">
        <h2
          id="approach-title"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          Abordagem comercial
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-secundary">
          Escolha um modelo, ajuste a mensagem e copie para iniciar a conversa.
        </p>
      </div>

      <div className="grid min-w-0 overflow-hidden rounded-2xl border border-sidebar-hover bg-card xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)]">
        <div className="min-w-0 space-y-6 border-b border-sidebar-hover bg-terciary/40 p-5 sm:p-7 xl:border-r xl:border-b-0">
          <div>
            <label
              htmlFor="approach-template"
              className="mb-2.5 block text-sm font-medium text-foreground"
            >
              Modelo de abordagem
            </label>
            <div className="relative">
              <select
                id="approach-template"
                value={selectedTemplateId}
                onChange={(event) => handleTemplateChange(event.target.value)}
                className="min-h-11 w-full min-w-0 appearance-none truncate rounded-lg border border-sidebar-hover bg-background py-3 pr-10 pl-3 text-sm text-foreground outline-none [color-scheme:dark] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-secundary"
              />
            </div>
          </div>

          <dl className="space-y-4 border-t border-sidebar-hover pt-5">
            <div>
              <dt className="text-xs text-secundary">Para</dt>
              <dd className="mt-1.5 text-sm font-medium leading-relaxed text-foreground [overflow-wrap:anywhere]">
                {leadName}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-secundary">De</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
                {userName}
              </dd>
            </div>
          </dl>

          <p className="max-w-sm border-l-2 border-primary/40 pl-3 text-xs leading-relaxed text-secundary">
            Revise os detalhes do negócio e inclua o link da prévia antes de
            copiar a mensagem.
          </p>
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sidebar-hover px-5 py-4 sm:px-7">
            <label
              htmlFor="approach-message"
              className="text-sm font-medium text-foreground"
            >
              Mensagem comercial
            </label>
            <span className="text-xs text-secundary">
              Edite antes de enviar
            </span>
          </div>

          <div className="flex flex-1 p-3 sm:p-4">
            <textarea
              id="approach-message"
              value={message}
              onChange={(event) => handleMessageChange(event.target.value)}
              aria-describedby="approach-message-hint"
              rows={14}
              className="custom-scrollbar min-h-80 w-full min-w-0 resize-y rounded-lg border border-transparent bg-transparent p-2 text-sm leading-7 text-foreground outline-none placeholder:text-secundary focus-visible:border-primary/50 focus-visible:bg-background/40 focus-visible:ring-2 focus-visible:ring-primary/15 sm:p-3"
            />
          </div>

          <div className="flex flex-col gap-4 border-t border-sidebar-hover bg-terciary/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <p
              id="approach-message-hint"
              className="max-w-xs text-xs leading-relaxed text-secundary"
            >
              Suas edições não alteram o modelo original.
            </p>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!message.trim()}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copied ? (
                <Check aria-hidden="true" className="size-4" />
              ) : (
                <Copy aria-hidden="true" className="size-4" />
              )}
              <span role="status">
                {copied ? "Mensagem copiada" : "Copiar mensagem"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
