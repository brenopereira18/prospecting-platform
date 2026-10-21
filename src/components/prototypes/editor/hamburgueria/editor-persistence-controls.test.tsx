import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorPersistenceControls } from "./editor-persistence-controls";
import type { usePrototypePersistence } from "./use-prototype-persistence";

function state(
  overrides: Partial<ReturnType<typeof usePrototypePersistence>> = {},
): ReturnType<typeof usePrototypePersistence> {
  return {
    name: "Proposta do cliente",
    setName: () => {},
    revision: 4,
    status: { kind: "idle", message: "" },
    busy: false,
    dirty: false,
    hasTemporaryImages: false,
    uploads: {},
    save: async () => {},
    createVersion: async () => {},
    ...overrides,
  };
}
const render = (persistence: ReturnType<typeof usePrototypePersistence>) =>
  renderToStaticMarkup(
    <EditorPersistenceControls id="private-id" persistence={persistence} />,
  );

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [
    node,
    ...Children.toArray(node.props.children as ReactNode).flatMap(elements),
  ];
}

function button(html: string, label: string) {
  const match = [
    ...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g),
  ].find(
    (item) =>
      item[1].includes(`aria-label="${label}"`) ||
      item[2].replace(/<[^>]+>/g, "") === label,
  );
  assert.ok(match, label);
  return match[1];
}

test("persistence controls expose internal name, revision, save and private version links", () => {
  const html = render(state({ dirty: true }));
  for (const text of [
    "Proposta do cliente",
    "Revisão 4",
    "Salvar rascunho",
    "Criar versão",
    'href="/prototipos/private-id/versoes"',
  ])
    assert.ok(html.includes(text), text);
  assert.doesNotMatch(button(html, "Criar versão"), /\sdisabled=""/);
});
test("saving, success and errors are visible and temporary images can be persisted explicitly", () => {
  for (const kind of ["saving", "saved", "error"] as const)
    assert.ok(
      render(
        state({
          status: { kind, message: `Estado ${kind}` },
          busy: kind === "saving",
        }),
      ).includes(`Estado ${kind}`),
    );
  const html = render(state({ dirty: true, hasTemporaryImages: true }));
  assert.ok(html.includes("As imagens usadas serão enviadas ao salvar"));
  assert.doesNotMatch(button(html, "Salvar rascunho"), /\sdisabled=""/);
  assert.match(
    button(render(state({ dirty: true, busy: true })), "Salvar rascunho"),
    /\sdisabled=""/,
  );
});

test("toolbar separates identification and actions with an explicitly labelled editable name", () => {
  const html = render(state());
  assert.ok(
    html.includes('aria-label="Identificação e salvamento do protótipo"'),
  );
  assert.ok(html.includes('aria-label="Histórico e ações do protótipo"'));
  assert.match(
    html,
    /<label[^>]*for="prototype-internal-name"[^>]*>Nome interno<\/label>/,
  );
  assert.match(
    html,
    /<input[^>]*id="prototype-internal-name"[^>]*maxLength="120"/,
  );
  assert.ok(html.includes('href="/prototipos"'));
  assert.ok(html.includes("Meus protótipos"));
  assert.ok(html.includes("Sem alterações pendentes"));
  assert.doesNotMatch(button(html, "Criar versão"), /bg-primary/);
  assert.match(button(html, "Salvar rascunho"), /bg-primary/);
});

test("name editing and action buttons keep the existing persistence callbacks", async () => {
  let name = "";
  const calls: string[] = [];
  const tree = elements(
    EditorPersistenceControls({
      id: "private-id",
      persistence: state({
        dirty: true,
        setName: (value) => {
          name = typeof value === "function" ? value(name) : value;
        },
        save: async () => {
          calls.push("save");
        },
        createVersion: async () => {
          calls.push("version");
        },
      }),
    }),
  );
  const input = tree.find((node) => node.type === "input")!;
  (input.props.onChange as (event: { target: { value: string } }) => void)({
    target: { value: "Novo nome interno" },
  });
  assert.equal(name, "Novo nome interno");
  for (const label of ["Salvar rascunho", "Criar versão"]) {
    const control = tree.find(
      (node) => node.type === "button" && node.props["aria-label"] === label,
    )!;
    await (control.props.onClick as () => Promise<void>)();
  }
  assert.deepEqual(calls, ["save", "version"]);
});

test("loading disables both actions, exposes busy state and never announces an early save", () => {
  for (const kind of ["saving", "versioning"] as const) {
    const html = render(
      state({
        busy: true,
        dirty: true,
        status: { kind, message: "Enviando imagens (1/2)…" },
      }),
    );
    assert.match(button(html, "Salvar rascunho"), /\sdisabled=""/);
    assert.match(button(html, "Criar versão"), /\sdisabled=""/);
    assert.ok(html.includes('aria-busy="true"'));
    assert.ok(html.includes("Enviando imagens (1/2)…"));
    assert.ok(!html.includes("Sem alterações pendentes"));
  }
  const clean = render(state());
  assert.match(button(clean, "Salvar rascunho"), /\sdisabled=""/);
  assert.doesNotMatch(button(clean, "Criar versão"), /\sdisabled=""/);
});

test("all controls retain native keyboard access, accessible names and visible focus", () => {
  const html = render(state({ dirty: true }));
  const controls = [...html.matchAll(/<(?:a|input|button)\b[^>]*>/g)];
  assert.equal(controls.length, 5);
  for (const [control] of controls) {
    assert.ok(control.includes("focus-visible:outline-primary"));
    assert.ok(!control.includes('tabindex="-1"'));
  }
  for (const label of ["Criar versão", "Salvar rascunho"]) {
    assert.ok(button(html, label).includes('type="button"'));
    assert.ok(button(html, label).includes(`aria-label="${label}"`));
  }
});

test("pending edits and late edits remain distinct from backend success and accessible errors", () => {
  assert.ok(render(state({ dirty: true })).includes("Alterações não salvas"));
  assert.ok(
    render(
      state({
        dirty: true,
        status: { kind: "saved", message: "Rascunho salvo com sucesso." },
      }),
    ).includes("Há novas alterações locais para salvar"),
  );
  const error = render(
    state({
      dirty: true,
      status: { kind: "error", message: "Não foi possível salvar." },
    }),
  );
  assert.match(error, /role="alert"/);
  assert.ok(error.includes("Não foi possível salvar."));
  const version = render(
    state({
      status: {
        kind: "version-created",
        message: "Versão 5 criada.",
        versionId: "v5",
      },
    }),
  );
  assert.ok(version.includes('href="/prototipos/private-id/versoes/v5"'));
  assert.ok(
    render(
      state({
        dirty: true,
        status: { kind: "version-created", message: "Versão 5 criada." },
      }),
    ).includes("Há novas alterações locais para salvar"),
  );
});
test("conflict keeps local edits and offers comparison in another tab instead of automatic restoration", () => {
  const html = render(
    state({
      dirty: true,
      status: {
        kind: "conflict",
        message: "Suas alterações locais foram mantidas.",
      },
    }),
  );
  assert.ok(html.includes("Suas alterações locais foram mantidas."));
  const comparison = html.match(
    /<a\b([^>]*)>Abrir rascunho salvo em outra aba<\/a>/,
  )?.[1];
  assert.ok(comparison);
  assert.ok(comparison.includes('href="/prototipos/private-id"'));
  assert.ok(comparison.includes('target="_blank"'));
  assert.ok(!html.includes("Descartar alterações"));
});
