import assert from "node:assert/strict";
import { test } from "node:test";
import { createEditorDocument } from "./editor-document";
import { editorSections, getPreviewSectionId, selectPreviewSection } from "./editor-navigation";
import { sectionAnchors, structuralSectionIds } from "../../templates/hamburgueria/lib/navigation";

test("preview selection uses the template's stable IDs and skips disabled or nonvisual panels", () => {
  const document = createEditorDocument();
  const before = structuredClone(document);
  for (const [section] of editorSections) {
    const actual = getPreviewSectionId(section, document.sections);
    if (section === "appearance" || section === "visibility") assert.equal(actual, null);
    else if (section === "header" || section === "footer") assert.equal(actual, structuralSectionIds[section]);
    else {
      assert.equal(actual, sectionAnchors[section].slice(1));
      assert.equal(getPreviewSectionId(section, { ...document.sections, [section]: false }), null);
    }
  }
  assert.deepEqual(document, before);
});

test("missing and disabled destinations do not scroll or add a highlight", () => {
  let queried = false;
  const document = {
    getElementById: () => { queried = true; return null; },
    createElement: () => assert.fail("No highlight without a destination"),
  } as unknown as Document;
  selectPreviewSection(document, null)();
  assert.equal(queried, false);
  selectPreviewSection(document, "missing")();
  assert.equal(queried, true);
});

test("highlight and scroll are scoped to the supplied frame and removed on deselection", () => {
  for (const reduced of [false, true]) {
    const attributes = new Map<string, string>();
    const styles: object[] = [];
    const scrolls: ScrollToOptions[] = [];
    const target = {
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      removeAttribute: (name: string) => attributes.delete(name),
      getBoundingClientRect: () => ({ top: 250 }),
    };
    const frameDocument = {
      getElementById: (id: string) => { assert.equal(id, "cardapio"); return target; },
      createElement: (name: string) => {
        assert.equal(name, "style");
        const style = { textContent: "", setAttribute() {}, remove() { styles.splice(styles.indexOf(style), 1); } };
        return style;
      },
      head: { appendChild: (style: object) => styles.push(style) },
      defaultView: {
        scrollY: 100,
        matchMedia: (query: string) => { assert.equal(query, "(prefers-reduced-motion: reduce)"); return { matches: reduced }; },
        scrollTo: (options: ScrollToOptions) => scrolls.push(options),
      },
    } as unknown as Document;
    const cleanup = selectPreviewSection(frameDocument, "cardapio");
    assert.equal(attributes.has("data-prospecta-selected-section"), true);
    assert.equal(styles.length, 1);
    assert.deepEqual(scrolls, [{ top: 350, behavior: reduced ? "instant" : "smooth" }]);
    cleanup();
    assert.equal(attributes.size, 0);
    assert.equal(styles.length, 0);
  }
});
