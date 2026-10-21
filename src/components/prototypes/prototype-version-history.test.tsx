import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  PrototypeVersionConfirmation,
  PrototypeVersionHistory,
  PrototypeVersionList,
} from "./prototype-version-history";
import { LeadPrototypes } from "./lead-prototypes";
import {
  editorNavigationIntent,
  prototypeHistoryHref,
} from "./prototype-navigation";
import { LeadTabs } from "../leads/lead-tabs";
import {
  EditorLeaveConfirmation,
  EditorPersistenceControls,
} from "./editor/hamburgueria/editor-persistence-controls";
import type {
  PrototypeSummaryDTO,
  PrototypeVersionSummaryDTO,
} from "../../server/prototypes/prototype.dto";
import type { usePrototypePersistence } from "./editor/hamburgueria/use-prototype-persistence";

const noop = () => {};
const prototype: PrototypeSummaryDTO = {
  id: "p1",
  leadId: "lead-a",
  name: "Proposta Central",
  templateId: "brasa-burger",
  templateVersion: 1,
  draftRevision: 3,
  versionCount: 3,
  createdAt: "2026-10-21T15:00:00.000Z",
  updatedAt: "2026-10-21T15:00:00.000Z",
};
const version = (
  number: number,
  prototypeId = "p1",
): PrototypeVersionSummaryDTO => ({
  id: `version-${number}`,
  prototypeId,
  number,
  createdAt: "2026-10-21T15:00:00.000Z",
});
const render = (node: ReactNode) =>
  renderToStaticMarkup(
    <AppRouterContext.Provider
      value={{
        push: noop,
        replace: noop,
        refresh: noop,
        back: noop,
        forward: noop,
        prefetch: noop,
        bfcacheId: "history-test",
      }}
    >
      {node}
    </AppRouterContext.Provider>,
  );

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [
    node,
    ...Children.toArray(node.props.children as ReactNode).flatMap(elements),
  ];
}

test("history navigation uses the real lead association and provides a safe orphan fallback", () => {
  assert.equal(
    prototypeHistoryHref(prototype),
    "/leads/lead-a?tab=prototypes&prototype=p1#prototipos",
  );
  assert.equal(
    prototypeHistoryHref({ ...prototype, leadId: null }),
    "/prototipos?prototype=p1#prototipo-p1",
  );
  const state = {
    name: "Nome",
    revision: 3,
    dirty: false,
    busy: false,
    status: { kind: "idle", message: "" },
    setName: noop,
    save: noop,
    createVersion: noop,
  } as unknown as ReturnType<typeof usePrototypePersistence>;
  const html = render(
    <EditorPersistenceControls
      id={prototype.id}
      leadId={prototype.leadId}
      persistence={state}
    />,
  );
  assert.ok(
    html.includes(
      'href="/leads/lead-a?tab=prototypes&amp;prototype=p1#prototipos"',
    ),
  );
  assert.ok(!html.includes('href="/prototipos/p1/versoes"'));
});

test("the lead section filters foreign lead data, highlights its selected prototype and expands its own history", () => {
  const html = render(
    <LeadPrototypes
      leadId="lead-a"
      selectedPrototypeId="p1"
      prototypes={[
        prototype,
        {
          ...prototype,
          id: "foreign",
          leadId: "lead-b",
          name: "Outro estabelecimento",
        },
      ]}
    />,
  );
  assert.ok(html.includes('id="prototipos"'));
  assert.ok(html.includes("Proposta Central"));
  assert.ok(!html.includes("Outro estabelecimento"));
  assert.match(html, /<details[^>]*open=""/);
  assert.ok(html.includes("Carregando versões"));
  assert.ok(html.includes("border-primary/60"));
  assert.ok(html.includes("Rascunho atual"));
  assert.ok(html.includes("Área de trabalho editável"));
  assert.ok(html.includes("Hamburgueria · 3 versões"));
  assert.ok(!html.includes("Revisão 3"));
});

test("direct history links select the prototypes tab instead of the analysis placeholder", () => {
  const html = render(
    <LeadTabs
      analysis={<p>Análise isolada</p>}
      initialTab="prototypes"
      prototypes={<section id="prototipos">Histórico deste lead</section>}
    />,
  );
  assert.ok(html.includes("Histórico deste lead"));
  assert.ok(!html.includes("Análise isolada"));
  assert.match(html, /role="tab"[^>]*prototypes-tab[^>]*aria-selected="true"/);
});

test("version rows are newest first, scoped to their prototype and expose all three distinct actions", () => {
  const html = render(
    <PrototypeVersionList
      prototypeId="p1"
      versions={[version(1), version(50, "other"), version(3)]}
      disabled={false}
      onAction={noop}
    />,
  );
  assert.ok(html.indexOf("Versão 3") < html.indexOf("Versão 1"));
  assert.ok(!html.includes("Versão 50"));
  assert.ok(html.includes('href="/prototipos/p1/versoes/version-3"'));
  for (const label of [
    "Visualizar versão 3",
    "Usar versão 3 como base",
    "Excluir versão 3",
  ])
    assert.ok(html.includes(`aria-label="${label}"`));
  assert.ok(html.includes("Usar como base"));
  assert.ok(!html.includes(">Editar</button>"));
});

test("edit and delete buttons select exactly their historical snapshot without executing a mutation", () => {
  const actions: unknown[] = [];
  const tree = elements(
    PrototypeVersionList({
      prototypeId: "p1",
      versions: [version(2)],
      disabled: false,
      onAction: (value) => actions.push(value),
    }),
  );
  for (const node of tree.filter((node) => node.type === "button"))
    (node.props.onClick as () => void)();
  assert.deepEqual(actions, [
    { kind: "restore", version: version(2) },
    { kind: "delete", version: version(2) },
  ]);
});

test("restore and destructive deletion start with closed labelled confirmations and explicit consequences", () => {
  for (const kind of ["restore", "delete"] as const) {
    const html = render(
      <PrototypeVersionConfirmation
        dialogRef={{ current: null }}
        prototype={prototype}
        selection={{ kind, version: version(7) }}
        pending={false}
        error=""
        onConfirm={noop}
        onRefresh={noop}
      />,
    );
    const dialog = html.match(/<dialog\b[^>]*>/)![0];
    assert.ok(!/\bopen(?:=|\s|>)/.test(dialog));
    assert.ok(dialog.includes("aria-labelledby="));
    assert.ok(dialog.includes("aria-describedby="));
    assert.ok(html.includes("versão 7"));
    assert.ok(html.includes("Cancelar"));
    assert.ok(
      html.includes(
        kind === "restore"
          ? "O rascunho atual será substituído pelo conteúdo desta versão. A versão 7 continuará preservada no histórico. Você poderá editar o rascunho e criar uma nova versão depois."
          : "Somente esta versão será excluída",
      ),
    );
    assert.ok(
      html.includes(
        kind === "restore"
          ? "Alterações não salvas em outras abas"
          : "as imagens armazenadas serão mantidos",
      ),
    );
    if (kind === "restore") {
      assert.ok(html.includes("Usar versão 7 como base?"));
      assert.ok(html.includes("Usar como base"));
      assert.ok(!html.includes("Editar a partir da versão"));
    }
  }
});

test("empty histories, pending confirmations and actionable errors remain accessible", () => {
  assert.ok(
    render(
      <PrototypeVersionList
        prototypeId="p1"
        versions={[]}
        disabled={false}
        onAction={noop}
      />,
    ).includes("Nenhuma versão criada"),
  );
  const html = render(
    <PrototypeVersionConfirmation
      dialogRef={{ current: null }}
      prototype={prototype}
      selection={{ kind: "delete", version: version(7) }}
      pending={true}
      error="Erro controlado"
      onConfirm={noop}
      onRefresh={noop}
    />,
  );
  assert.ok(html.includes('role="alert"'));
  assert.ok(html.includes("Atualizar dados"));
  assert.match(html, /<button[^>]*disabled=""[^>]*>[\s\S]*?Excluindo/);
  assert.ok(
    render(<PrototypeVersionHistory prototype={prototype} />).includes(
      "Histórico de versões",
    ),
  );
});

test("leaving an unsaved editor requires confirmation while modified clicks keep the current editor open", () => {
  const event = {
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
  };
  assert.equal(editorNavigationIntent(event, false, false), "allow");
  assert.equal(editorNavigationIntent(event, true, false), "confirm");
  assert.equal(editorNavigationIntent(event, true, true), "blocked");
  for (const key of ["ctrlKey", "metaKey", "shiftKey", "altKey"] as const)
    assert.equal(
      editorNavigationIntent({ ...event, [key]: true }, true, false),
      "allow",
    );
  const html = render(
    <EditorLeaveConfirmation
      dialogRef={{ current: null }}
      href={prototypeHistoryHref(prototype)}
    />,
  );
  assert.ok(
    html.includes(
      "alterações locais e as imagens temporárias serão descartadas",
    ),
  );
  assert.ok(html.includes("Cancelar"));
  assert.ok(html.includes("Sair sem salvar"));
});
