"use client";

import { useId, useRef, useState } from "react";
import {
  ChartNoAxesCombined,
  Layers,
  MessagesSquare,
  Send,
} from "lucide-react";

type LeadTab = "analysis" | "approach" | "interactions" | "prototypes";

const tabs = [
  {
    id: "analysis",
    label: "Análise",
    icon: ChartNoAxesCombined,
    description: "Consulte os sinais de oportunidade deste negócio.",
  },
  {
    id: "approach",
    label: "Abordagem",
    icon: Send,
    description:
      "A preparação da abordagem comercial estará disponível aqui. Por enquanto, consulte a análise para conhecer o negócio.",
  },
  {
    id: "interactions",
    label: "Interações",
    icon: MessagesSquare,
    description:
      "O histórico de conversas com este lead estará disponível aqui em breve.",
  },
  {
    id: "prototypes",
    label: "Protótipos",
    icon: Layers,
    description:
      "Os protótipos deste negócio aparecerão aqui quando a geração estiver disponível.",
  },
] as const;

interface LeadTabsProps {
  analysis: React.ReactNode;
  approach?: React.ReactNode;
  interactions?: React.ReactNode;
  prototypes?: React.ReactNode;
}

export function LeadTabs({
  analysis,
  approach,
  interactions,
  prototypes,
}: LeadTabsProps) {
  const [activeTab, setActiveTab] = useState<LeadTab>("analysis");
  const id = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedTab = tabs.find((tab) => tab.id === activeTab)!;
  const SelectedIcon = selectedTab.icon;

  const content = {
    analysis,
    approach,
    interactions,
    prototypes,
  };

  return (
    <div className="min-w-0 space-y-7">
      <div
        role="tablist"
        aria-label="Informações do lead"
        className="flex gap-4 overflow-x-auto border-b border-sidebar-hover sm:gap-7"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            role="tab"
            id={`${id}-${tab.id}-tab`}
            aria-controls={`${id}-${tab.id}-panel`}
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => {
              let nextIndex = index;
              if (event.key === "ArrowRight")
                nextIndex = (index + 1) % tabs.length;
              else if (event.key === "ArrowLeft")
                nextIndex = (index - 1 + tabs.length) % tabs.length;
              else if (event.key === "Home") nextIndex = 0;
              else if (event.key === "End") nextIndex = tabs.length - 1;
              else return;
              event.preventDefault();
              setActiveTab(tabs[nextIndex].id);
              tabRefs.current[nextIndex]?.focus();
            }}
            className={`flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-secundary hover:border-sidebar-hover hover:text-foreground"
            }`}
          >
            <tab.icon aria-hidden="true" className="size-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div
        key={activeTab}
        role="tabpanel"
        id={`${id}-${activeTab}-panel`}
        aria-labelledby={`${id}-${activeTab}-tab`}
        tabIndex={0}
        className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        {content[activeTab] ?? (
          <section className="flex flex-col items-center rounded-2xl border border-dashed border-sidebar-hover bg-terciary/40 px-6 py-14 text-center sm:py-20">
            <div className="mb-5 flex size-12 items-center justify-center rounded-xl border border-sidebar-hover bg-card text-secundary">
              <SelectedIcon
                aria-hidden="true"
                className="size-5"
                strokeWidth={1.5}
              />
            </div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {selectedTab.label}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-secundary">
              {selectedTab.description}
            </p>
            <span className="mt-5 rounded-full border border-sidebar-hover px-3 py-1 text-xs text-secundary">
              Em breve
            </span>
          </section>
        )}
      </div>
    </div>
  );
}
