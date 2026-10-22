import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PrototypePagination } from "./prototype-pagination";
import {
  getPrototypePageRedirect,
  parsePrototypePage,
  prototypePageHref,
} from "./prototype-pagination.utils";

const noop = () => {};
function render(page: number, totalPages: number, totalCount: number) {
  return renderToStaticMarkup(
    <AppRouterContext.Provider
      value={{
        push: noop,
        replace: noop,
        refresh: noop,
        back: noop,
        forward: noop,
        prefetch: noop,
        bfcacheId: "pagination-test",
      }}
    >
      <PrototypePagination page={page} totalPages={totalPages} totalCount={totalCount} />
    </AppRouterContext.Provider>,
  );
}

test("page parsing defaults missing and invalid values to page one", () => {
  assert.deepEqual(parsePrototypePage(undefined), { page: 1, valid: true });
  assert.deepEqual(parsePrototypePage("2"), { page: 2, valid: true });
  for (const value of ["0", "-1", "1.5", "abc", "", "9007199254740992"])
    assert.deepEqual(parsePrototypePage(value), { page: 1, valid: false });
  assert.deepEqual(parsePrototypePage(["2", "3"]), { page: 1, valid: false });
});

test("pagination renders item range and accessible previous and next links", () => {
  const html = render(2, 5, 87);
  assert.ok(html.includes("Exibindo 21–40 de 87 protótipos"));
  assert.ok(html.includes("Página 2 de 5"));
  assert.ok(html.includes('aria-label="Paginação dos protótipos"'));
  assert.ok(html.includes('href="/prototipos"'));
  assert.ok(html.includes('href="/prototipos?page=3"'));
});

test("pagination hides navigation on one page and disables missing directions", () => {
  const single = render(1, 1, 4);
  assert.equal(single, "");
  const first = render(1, 3, 45);
  assert.ok(first.includes('aria-disabled="true"'));
  assert.ok(first.includes('href="/prototipos?page=2"'));
  const last = render(3, 3, 45);
  assert.ok(last.includes('href="/prototipos?page=2"'));
  assert.equal((last.match(/aria-disabled="true"/g) ?? []).length, 1);
});

test("page links drop page one and preserve selected prototype", () => {
  assert.equal(prototypePageHref(1), "/prototipos");
  assert.equal(prototypePageHref(2, "selected id"), "/prototipos?page=2&prototype=selected+id");
});

test("an out-of-range page returns the last valid page after deletions", () => {
  assert.equal(getPrototypePageRedirect(2, 20), 1);
  assert.equal(getPrototypePageRedirect(2, 0), 1);
  assert.equal(getPrototypePageRedirect(2, 21), null);
  assert.equal(getPrototypePageRedirect(2, 21, false), 1);
  assert.equal(getPrototypePageRedirect(4, 41), 3);
});
