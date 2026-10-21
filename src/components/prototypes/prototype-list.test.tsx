import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { Sidebar } from "../app-shell/sidebar";
import { PrototypeList } from "./prototype-list";
import type { PrototypeSummaryDTO } from "../../server/prototypes/prototype.dto";

const prototype: PrototypeSummaryDTO = {
  id: "p1",
  name: "Proposta interna",
  businessName: "Nome do documento",
  leadName: "SillGames",
  leadId: "lead1",
  categoryName: "Hamburgueria",
  templateId: "brasa-burger",
  templateVersion: 1,
  draftRevision: 9,
  createdAt: "2026-10-20T12:00:00Z",
  updatedAt: "2026-10-22T12:00:00Z",
  latestVersion: {
    id: "v3",
    prototypeId: "p1",
    number: 3,
    createdAt: "2026-10-21T17:29:00Z",
  },
};
const noop = () => {};
const render = (value: PrototypeSummaryDTO) =>
  renderToStaticMarkup(
    <AppRouterContext.Provider
      value={{
        push: noop,
        replace: noop,
        refresh: noop,
        back: noop,
        forward: noop,
        prefetch: noop,
        bfcacheId: "list-test",
      }}
    >
      <PrototypeList prototypes={[value]} />
    </AppRouterContext.Provider>,
  );

test("cards show one establishment heading and the latest real snapshot date, without draft technical metadata", () => {
  const html = render(prototype);
  assert.equal(
    (html.replace(/<[^>]*>/g, "").match(/SillGames/g) ?? []).length,
    1,
  );
  assert.ok(!html.includes("Nome do documento"));
  assert.ok(!html.includes("Template 1"));
  assert.ok(!html.includes("Revisão"));
  assert.ok(html.includes("Versão 3"));
  assert.ok(html.includes("21/10/2026 às 14:29"));
  assert.match(html, /datetime="2026-10-21T17:29:00Z"/i);
});

test("cards keep explicit draft, real preview, history and confirmed deletion actions without loading embedded renderers", () => {
  const html = render(prototype);
  for (const href of [
    "/prototipos/p1",
    "/prototipos/p1/previa",
    "/leads/lead1?tab=prototypes&amp;prototype=p1#prototipos",
  ])
    assert.ok(html.includes(`href="${href}"`));
  assert.ok(html.includes("Editar rascunho"));
  assert.ok(html.includes("Prévia"));
  assert.ok(html.includes("Excluir definitivamente"));
  assert.ok(!/<dialog[^>]*\sopen[= >]/.test(html));
  assert.ok(!html.includes("<iframe"));
  assert.ok(html.includes("md:grid-cols-2"));
  assert.ok(html.includes("motion-safe:transition-"));
  assert.ok(html.includes("focus-visible:outline-primary"));
  assert.ok(html.includes("items-stretch"));
  assert.ok(html.includes("flex h-full flex-col"));
  assert.ok(html.includes("line-clamp-2 min-h-14"));
  assert.ok(html.includes("mt-auto flex"));
  assert.ok(html.includes("aspect-[2.5/1]"));
});

test("legacy prototypes use document or internal names and never invent a version or date", () => {
  const html = render({
    ...prototype,
    leadId: null,
    leadName: null,
    categoryName: null,
    businessName: "Legado",
    latestVersion: null,
  });
  assert.ok(html.includes("Legado"));
  assert.ok(html.includes("Nenhuma versão criada"));
  assert.ok(!html.includes("<time"));
  assert.ok(html.includes("Histórico de versões"));
  assert.ok(
    render({
      ...prototype,
      leadId: null,
      leadName: null,
      businessName: "",
      latestVersion: null,
    }).includes("Proposta interna"),
  );
});

test("only the listing uses the existing dashboard route group and its shared sidebar", () => {
  assert.ok(existsSync("src/app/(dashboard)/prototipos/page.tsx"));
  assert.ok(!existsSync("src/app/prototipos/page.tsx"));
  const layout = readFileSync("src/app/(dashboard)/layout.tsx", "utf8");
  assert.ok(layout.includes("<Sidebar />"));
  const page = readFileSync("src/app/(dashboard)/prototipos/page.tsx", "utf8");
  assert.ok(page.includes("requirePrototypeUser()"));
  assert.ok(!page.includes("<Sidebar"));
});

test("the existing sidebar compacts only for the prototype listing and keeps accessible navigation on mobile", () => {
  const sidebar = (path: string) =>
    renderToStaticMarkup(
      <PathnameContext.Provider value={path}>
        <Sidebar />
      </PathnameContext.Provider>,
    );
  const compact = sidebar("/prototipos");
  assert.ok(compact.includes("w-16 shrink-0 sm:w-60"));
  assert.ok(compact.includes("min-h-11"));
  for (const label of ["Dashboard", "Leads", "Protótipos", "Configurações"])
    assert.ok(compact.includes(`aria-label="${label}"`));
  for (const path of ["/leads", "/dashboard", "/descobrir-negocios"]) {
    const original = sidebar(path);
    assert.ok(!original.includes("w-16"));
    assert.ok(!original.includes("hidden sm:inline"));
  }
});
