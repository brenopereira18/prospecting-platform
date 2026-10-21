import { encodeThumbnail } from "./thumbnail-image";
import { ThumbnailError, type CaptureThumbnail } from "./thumbnail.service";

export function thumbnailOrigin(value = process.env.THUMBNAIL_APP_ORIGIN) {
  if (!value && process.env.NODE_ENV === "production")
    throw new Error("THUMBNAIL_APP_ORIGIN is required");
  const url = new URL(value || "http://127.0.0.1:3000");
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    )
  )
    throw new Error("Invalid THUMBNAIL_APP_ORIGIN");
  return url.origin;
}

// No queue: bound the browser cost per Node process and let the explicit action be retried.
let capturing = false;
export const captureThumbnail: CaptureThumbnail = async (
  prototypeId,
  versionId,
  sessionToken,
) => {
  if (capturing)
    throw new ThumbnailError(
      "BUSY",
      "Há outra captura em andamento. Aguarde e tente novamente.",
      429,
    );
  const origin = thumbnailOrigin();
  const path = `/prototipos/${prototypeId}/versoes/${versionId}`;
  capturing = true;
  let stage = "browser";
  let browser:
    | Awaited<ReturnType<(typeof import("playwright"))["chromium"]["launch"]>>
    | undefined;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true, timeout: 15_000 });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
      serviceWorkers: "block",
      acceptDownloads: false,
    });
    await context.addCookies([
      {
        name: "session",
        value: sessionToken,
        url: origin,
        httpOnly: true,
        secure: origin.startsWith("https:"),
        sameSite: "Lax",
      },
    ]);
    // Capture the trusted application only. Never forward cookies or navigate to user-provided URLs.
    await context.route("**/*", (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (
        url.origin !== origin ||
        (request.isNavigationRequest() && url.pathname !== path)
      )
        return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    stage = "navigation";
    const response = await page.goto(`${origin}${path}`, {
      waitUntil: "domcontentloaded",
      timeout: 25_000,
    });
    if (!response?.ok() || new URL(page.url()).pathname !== path)
      throw new Error("Snapshot not accessible");
    const template = page.locator(".hamburgueria-template");
    stage = "template";
    await template.waitFor({ state: "visible" });
    await template.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, 0));
    stage = "fonts";
    try {
      await page.waitForFunction(() => {
        if (document.fonts.status !== "loaded") return false;
        const root = document.querySelector(".hamburgueria-template");
        if (!root) return false;
        const top = root.getBoundingClientRect().top;
        // next/font's local Arial fallback may fail on Linux even after the
        // real webfont loads. Check the actual primary faces in the crop.
        return Array.from(root.querySelectorAll("*")).every((element) => {
          const text = Array.from(element.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent ?? "")
            .join("")
            .trim();
          const box = element.getBoundingClientRect();
          if (
            !text ||
            !box.width ||
            !box.height ||
            box.bottom <= top ||
            box.top >= top + 810
          )
            return true;
          const style = getComputedStyle(element);
          if (style.visibility === "hidden") return true;
          const family = style.fontFamily.split(",")[0];
          return document.fonts.check(
            `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${family}`,
            text,
          );
        });
      });
    } catch (cause) {
      console.error(
        "Estado das fontes na captura.",
        await page.evaluate(() => ({
          status: document.fonts.status,
          failed: Array.from(document.fonts)
            .filter((font) => font.status === "error")
            .map((font) => ({ family: font.family, weight: font.weight })),
        })),
      );
      throw cause;
    }
    stage = "images";
    await page.waitForFunction(
      () => {
        const root = document.querySelector(".hamburgueria-template");
        if (!root) return false;
        const top = root.getBoundingClientRect().top;
        return Array.from(root.querySelectorAll("img")).every((image) => {
          const box = image.getBoundingClientRect();
          if (
            box.bottom <= top ||
            box.top >= top + 810 ||
            !box.width ||
            !box.height
          )
            return true;
          image.loading = "eager";
          return image.complete && image.naturalWidth > 0;
        });
      },
      undefined,
      { timeout: 20_000 },
    );
    const box = await template.boundingBox();
    if (!box || box.width < 1400 || box.height < 1)
      throw new Error("Invalid snapshot surface");
    // Crop the upper 16:9 surface; the private preview toolbar is outside this element.
    stage = "screenshot";
    const png = await page.screenshot({
      type: "png",
      animations: "disabled",
      timeout: 10_000,
      clip: {
        x: box.x,
        y: box.y,
        width: 1440,
        height: Math.min(box.height, 810),
      },
    });
    stage = "encoding";
    return await encodeThumbnail(png);
  } catch (cause) {
    console.error("Falha na captura de miniatura.", {
      stage,
      detail: (cause instanceof Error
        ? cause.message
        : "Unknown error"
      ).replaceAll(sessionToken, "[redacted]"),
    });
    throw new Error(`A captura falhou na etapa ${stage}.`, { cause });
  } finally {
    try {
      await browser?.close();
    } finally {
      capturing = false;
    }
  }
};
