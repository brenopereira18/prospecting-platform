import assert from "node:assert/strict";
import { test } from "node:test";
import { connectPreviewFrame } from "./preview-frame";

class Frame extends EventTarget {
  contentDocument = { URL: "about:srcdoc", readyState: "complete", body: {} } as Document;
}

test("initializes a frame whose load event preceded hydration", async () => {
  const frame = new Frame();
  frame.dispatchEvent(new Event("load"));
  const documents: Document[] = [];
  const disconnect = connectPreviewFrame(frame, document => documents.push(document), assert.fail);
  await Promise.resolve();
  disconnect();
  assert.deepEqual(documents, [frame.contentDocument]);
});

test("waits for srcDoc rather than mounting into the initial about:blank document", async () => {
  const frame = new Frame();
  frame.contentDocument = { URL: "about:blank", readyState: "complete", body: {} } as Document;
  const documents: Document[] = [];
  const disconnect = connectPreviewFrame(frame, document => documents.push(document), assert.fail);
  frame.dispatchEvent(new Event("load"));
  await Promise.resolve();
  assert.equal(documents.length, 0);
  frame.contentDocument = { URL: "about:srcdoc", readyState: "complete", body: {} } as Document;
  frame.dispatchEvent(new Event("load"));
  frame.dispatchEvent(new Event("load"));
  disconnect();
  assert.deepEqual(documents, [frame.contentDocument]);
});

test("reports initialization failures with their original cause", async () => {
  const frame = new Frame();
  const cause = new Error("Falha ao copiar estilos");
  const errors: Error[] = [];
  const disconnect = connectPreviewFrame(frame, () => { throw cause; }, error => errors.push(error));
  await Promise.resolve();
  disconnect();
  assert.deepEqual(errors, [cause]);
});

test("reports a stalled load instead of leaving an infinite loading state", async () => {
  const frame = new Frame();
  frame.contentDocument = { URL: "about:srcdoc", readyState: "loading" } as Document;
  const error = await new Promise<Error>(resolve => {
    connectPreviewFrame(frame, () => assert.fail("Frame is still loading"), resolve, 5);
  });
  assert.match(error.message, /tempo limite/i);
});

test("cleanup cancels pending initialization and permits a fresh attempt", async () => {
  const frame = new Frame();
  const documents: Document[] = [];
  const disconnect = connectPreviewFrame(frame, () => assert.fail("Disconnected"), assert.fail, 5);
  disconnect();
  frame.dispatchEvent(new Event("load"));
  await new Promise(resolve => setTimeout(resolve, 10));
  const retry = connectPreviewFrame(frame, document => documents.push(document), assert.fail);
  await Promise.resolve();
  retry();
  assert.deepEqual(documents, [frame.contentDocument]);
});
