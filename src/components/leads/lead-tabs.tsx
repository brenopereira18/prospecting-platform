"use client";

import { useState } from "react";

type LeadTab = "analysis" | "approach" | "interactions" | "prototypes";

const tabs: { id: LeadTab; label: string }[] = [
  { id: "analysis", label: "Análise" },
  { id: "approach", label: "Abordagem" },
  { id: "interactions", label: "Interações" },
  { id: "prototypes", label: "Protótipos" },
];

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

  const content = {
    analysis,
    approach,
    interactions,
    prototypes,
  };

  return (
    <div className="space-y-4">
      <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg border border-sidebar-hover bg-terciary p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-white shadow-sm"
                : "text-secundary hover:bg-sidebar-hover hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {content[activeTab] ?? (
          <section className="rounded-xl border border-sidebar-hover bg-terciary p-6 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">
              {tabs.find((tab) => tab.id === activeTab)?.label}
            </h2>

            <p className="mt-2 text-sm text-secundary">
              Esta funcionalidade será implementada em breve.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
