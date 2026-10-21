import type { EditorPanelSection } from "./editor-navigation";

const reviewItems = [
  ["header", "Nome, linhas da marca e ano de fundação"],
  ["hero", "Especialidade, promessa principal e selo"],
  ["menu", "Produtos, fotos, preços e adicionais de exemplo"],
  ["story", "História e oferta coerentes com o estabelecimento"],
  ["howToOrder", "WhatsApp e modalidades de atendimento"],
  ["reviews", "Origem da nota, da contagem e dos depoimentos"],
  ["location", "Endereço, mapa, horários e condições de entrega"],
  ["faq", "Respostas compatíveis com o atendimento"],
  ["footer", "Marca, redes sociais e resumo de atendimento"],
] as const satisfies ReadonlyArray<readonly [EditorPanelSection, string]>;

export function EditorCommercialReview({
  onSelectSection,
}: {
  onSelectSection: (section: EditorPanelSection) => void;
}) {
  return (
    <details className="my-3 rounded-lg border border-sidebar-hover p-3">
      <summary className="cursor-pointer text-xs font-medium">
        Revisão para apresentação
      </summary>
      <p className="mt-3 text-xs leading-relaxed text-secundary">
        O template permanece completo com exemplos. Antes de apresentar, confira
        as informações abaixo. Horários, resumos e respostas do FAQ são textos
        independentes; revise-os em conjunto.
      </p>
      <ul className="mt-2 space-y-1">
        {reviewItems.map(([section, label]) => (
          <li key={section}>
            <button
              type="button"
              onClick={() => onSelectSection(section)}
              className="w-full rounded px-1 py-2 text-left text-xs text-secundary underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
