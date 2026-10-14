"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AtSign,
  Check,
  ChevronDown,
  Mail,
  MessageCircle,
  MessagesSquare,
  Phone,
  Plus,
  type LucideIcon,
} from "lucide-react";

import type {
  InteractionChannel,
  InteractionType,
} from "../../../generated/prisma/enums";

import type { LeadInteractionDTO } from "../../server/lead-interactions/lead-interaction.dto";

import {
  INTERACTION_CHANNEL_LABELS,
  INTERACTION_TYPE_LABELS,
} from "../../constants/lead-interactions";

import { createInteractionAction } from "../../app/(dashboard)/leads/[id]/actions";

interface LeadInteractionsProps {
  leadId: string;
  interactions: LeadInteractionDTO[];
}

const channelIcons: Record<InteractionChannel, LucideIcon> = {
  WHATSAPP: MessageCircle,
  INSTAGRAM: AtSign,
  EMAIL: Mail,
  PHONE: Phone,
  OTHER: MessagesSquare,
};

const selectClassName =
  "min-h-11 w-full min-w-0 appearance-none rounded-lg border border-sidebar-hover bg-background py-3 pr-10 pl-3 text-sm text-foreground outline-none [color-scheme:dark] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25";

export function LeadInteractions({
  leadId,
  interactions,
}: LeadInteractionsProps) {
  const router = useRouter();

  const [isPending, startTransition] = useTransition();

  const [channel, setChannel] = useState<InteractionChannel>("WHATSAPP");

  const [type, setType] = useState<InteractionType>("FIRST_CONTACT");

  const [notes, setNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        const result = await createInteractionAction({
          leadId,
          channel,
          type,
          notes,
        });

        if (!result.success) {
          setError(result.error ?? "Não foi possível registrar a interação.");
          return;
        }

        setNotes("");
        setSuccess(true);
        router.refresh();
      } catch {
        setError("Ocorreu um erro ao registrar a interação.");
      }
    });
  }

  return (
    <section aria-labelledby="interactions-title" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2
            id="interactions-title"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            Interações com o lead
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-secundary">
            Registre cada contato e mantenha o contexto da conversa por perto.
          </p>
        </div>
        <span className="rounded-full border border-sidebar-hover bg-card px-3 py-1.5 text-xs text-secundary tabular-nums">
          {interactions.length}{" "}
          {interactions.length === 1 ? "registro" : "registros"}
        </span>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)]">
        <section
          aria-labelledby="interaction-form-title"
          className="min-w-0 overflow-hidden rounded-2xl border border-sidebar-hover bg-card"
        >
          <div className="border-b border-sidebar-hover px-5 py-5 sm:px-6">
            <h3
              id="interaction-form-title"
              className="text-sm font-semibold text-foreground"
            >
              Registrar interação
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-secundary">
              Adicione o contato e o que foi conversado.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
              <div>
                <label
                  htmlFor="interaction-channel"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Canal
                </label>

                <div className="relative">
                  <select
                    id="interaction-channel"
                    value={channel}
                    onChange={(event) =>
                      setChannel(event.target.value as InteractionChannel)
                    }
                    className={selectClassName}
                  >
                    {Object.entries(INTERACTION_CHANNEL_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-secundary"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="interaction-type"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Tipo de interação
                </label>

                <div className="relative">
                  <select
                    id="interaction-type"
                    value={type}
                    onChange={(event) =>
                      setType(event.target.value as InteractionType)
                    }
                    className={selectClassName}
                  >
                    {Object.entries(INTERACTION_TYPE_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-secundary"
                  />
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="interaction-notes"
                className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm font-medium text-foreground"
              >
                Observações
                <span className="text-xs font-normal text-secundary">
                  Opcional
                </span>
              </label>

              <textarea
                id="interaction-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={2000}
                rows={5}
                aria-describedby="interaction-notes-count"
                placeholder="Ex.: Enviei a prévia pelo WhatsApp. Ficou de avaliar e responder amanhã."
                className="custom-scrollbar block min-h-36 w-full resize-y rounded-lg border border-sidebar-hover bg-background px-3 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-secundary/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
              />
              <p
                id="interaction-notes-count"
                className="mt-2 text-right text-xs text-secundary tabular-nums"
              >
                {notes.length.toLocaleString("pt-BR")} / 2.000 caracteres
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2.5 text-sm leading-relaxed text-red-300"
              >
                {error}
              </p>
            )}

            {success && (
              <p
                role="status"
                className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2.5 text-sm leading-relaxed text-primary"
              >
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                Interação registrada.
              </p>
            )}

            <div className="border-t border-sidebar-hover pt-5">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus aria-hidden="true" className="size-4" />
                {isPending ? "Registrando..." : "Registrar interação"}
              </button>
            </div>
          </form>
        </section>

        <section
          aria-labelledby="interaction-history-title"
          className="min-w-0 rounded-2xl border border-sidebar-hover bg-terciary/30 p-5 sm:p-7"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-sidebar-hover pb-5">
            <h3
              id="interaction-history-title"
              className="text-sm font-semibold text-foreground"
            >
              Histórico de interações
            </h3>
            <span className="text-xs text-secundary">
              Mais recentes primeiro
            </span>
          </div>

          {interactions.length === 0 ? (
            <div className="flex flex-col items-center px-2 py-14 text-center sm:py-20">
              <MessagesSquare
                aria-hidden="true"
                className="mb-4 size-7 text-secundary"
                strokeWidth={1.5}
              />
              <h4 className="text-sm font-medium text-foreground">
                A conversa começa com o primeiro contato
              </h4>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-secundary">
                Registre uma interação no formulário. Os contatos e suas
                observações aparecerão aqui.
              </p>
            </div>
          ) : (
            <ol className="mt-6">
              {interactions.map((interaction, index) => {
                const ChannelIcon = channelIcons[interaction.channel];

                return (
                  <li
                    key={interaction.id}
                    className="relative pb-8 pl-12 last:pb-0"
                  >
                    {index < interactions.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute top-9 bottom-1 left-4 w-px bg-sidebar-hover"
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className={`absolute top-0 left-0 flex size-8 items-center justify-center rounded-full border ${index === 0 ? "border-primary/30 bg-primary/10 text-primary" : "border-sidebar-hover bg-card text-secundary"}`}
                    >
                      <ChannelIcon className="size-3.5" />
                    </span>

                    <article className="min-w-0 pt-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-foreground">
                            {INTERACTION_TYPE_LABELS[interaction.type]}
                          </h4>
                          <p className="mt-1.5 text-xs text-secundary">
                            {INTERACTION_CHANNEL_LABELS[interaction.channel]}
                          </p>
                        </div>

                        <time
                          dateTime={new Date(
                            interaction.createdAt,
                          ).toISOString()}
                          className="text-xs leading-5 text-secundary tabular-nums"
                        >
                          {new Intl.DateTimeFormat("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(interaction.createdAt))}
                        </time>
                      </div>

                      {interaction.notes && (
                        <p className="mt-3 max-w-prose whitespace-pre-wrap text-sm leading-7 text-foreground/85 [overflow-wrap:anywhere]">
                          {interaction.notes}
                        </p>
                      )}
                    </article>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </section>
  );
}
