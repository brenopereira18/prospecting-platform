import { Funnel } from "lucide-react";

export function FunnelCard() {
  return (
    <section className="mt-6 rounded-xl border border-sidebar-hover bg-card text-foreground shadow">
      <div className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Funnel className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Funil comercial</h2>
          </div>

          <span className="text-xs text-secundary">Distribuição por etapa</span>
        </div>

        <div className="space-y-3.5">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium">Leads encontrados</span>
              <span className="text-secundary">12</span>
            </div>

            <div className="relative h-2.5 overflow-hidden rounded-full bg-sidebar-hover">
              <div className="absolute inset-y-0 left-0 w-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all" />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium">Leads cadastrados</span>
              <span className="text-secundary">6</span>
            </div>

            <div className="relative h-2.5 overflow-hidden rounded-full bg-sidebar-hover">
              <div className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all" />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium">Propostas enviadas</span>
              <span className="text-secundary">1</span>
            </div>

            <div className="relative h-2.5 overflow-hidden rounded-full bg-sidebar-hover">
              <div className="absolute inset-y-0 left-0 w-[8.33%] rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all" />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium">Ganhos</span>
              <span className="text-secundary">1</span>
            </div>

            <div className="relative h-2.5 overflow-hidden rounded-full bg-sidebar-hover">
              <div className="absolute inset-y-0 left-0 w-[8.33%] rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all" />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium">Perdidos</span>
              <span className="text-secundary">1</span>
            </div>

            <div className="relative h-2.5 overflow-hidden rounded-full bg-sidebar-hover">
              <div className="absolute inset-y-0 left-0 w-[8.33%] rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all" />
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-xl border border-sidebar-hover bg-sidebar-hover/40 px-4 py-3">
          <span className="text-sm text-secundary">Taxa de conversão</span>
          <span className="text-2xl font-semibold text-icon-success">17%</span>
        </div>
      </div>
    </section>
  );
}
