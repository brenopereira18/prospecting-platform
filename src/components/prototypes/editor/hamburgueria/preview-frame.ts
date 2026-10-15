/** Subscribe to the srcDoc frame without relying on React's hydration timing. */
export function connectPreviewFrame(
  frame: Pick<HTMLIFrameElement, "contentDocument" | "addEventListener" | "removeEventListener">,
  onReady: (document: Document) => void,
  onError: (error: Error) => void,
  timeoutMs = 10_000,
) {
  let settled = false;
  const cleanup = () => {
    settled = true;
    clearTimeout(timeout);
    frame.removeEventListener("load", initialize);
  };
  const fail = (cause: unknown) => {
    cleanup();
    onError(cause instanceof Error ? cause : new Error(String(cause)));
  };
  const initialize = () => {
    if (settled) return;
    try {
      const document = frame.contentDocument;
      // The initial about:blank body is replaced when srcDoc loads.
      if (!document || document.URL !== "about:srcdoc" || document.readyState !== "complete" || !document.body) return;
      onReady(document);
      cleanup();
    } catch (cause) {
      fail(cause);
    }
  };
  const timeout = setTimeout(() => fail(new Error("A prévia excedeu o tempo limite de carregamento.")), timeoutMs);
  frame.addEventListener("load", initialize);
  // srcDoc can finish loading before React hydrates and attaches listeners.
  queueMicrotask(initialize);
  return cleanup;
}
