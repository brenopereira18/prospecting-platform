import { proposalReference, proposalSections } from "./proposal-presentation";
import {
  formatMoney,
  formatProposalDate,
  type ProposalDTO,
} from "./proposal.schema";

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
export function proposalPdfHtml(proposal: ProposalDTO) {
  const sections = proposalSections(proposal);
  const renderSection = (section: (typeof sections)[number], index: number) =>
    `<section class="section" data-section="${index}"><h2>${escape(
      index === 0
        ? "Objetivo do projeto"
        : section.title === "Observações"
          ? "Observações e condições comerciais"
          : section.title,
    )}</h2><p>${escape(section.text)}</p></section>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Proposta ${proposalReference(proposal)}</title><style>
  @page{size:A4;margin:18mm 18mm 22mm}
  *{box-sizing:border-box}
  body{width:174mm;margin:0;font-family:Arial,Helvetica,sans-serif;color:#173440;font-size:11.5px;line-height:1.55}
  .pdf-page{display:flow-root;break-after:page}.pdf-page:last-child{break-after:auto}
  header{border-top:3px solid #287f89;padding:13px 0 0;break-inside:avoid}
  .meta{display:flex;justify-content:space-between;align-items:center;gap:24px;color:#5d7078;font-size:10px}
  .brand{font-size:23px;line-height:1.2;letter-spacing:-.6px;font-weight:700;color:#287f89}
  .reference{text-align:right}
  .parties{display:flex;gap:32px;padding:20px 0 17px;border-bottom:1px solid #dce6e8}
  .parties>div{flex:1;min-width:0}.parties p+p{margin-top:2px}.label{color:#5d7078;font-size:10px;margin-bottom:4px}
  h1{font-size:27px;line-height:1.18;letter-spacing:-.5px;margin:0;padding:20px 0 5px;overflow-wrap:anywhere;white-space:pre-wrap;break-after:avoid}
  h2{font-size:12.5px;line-height:1.35;margin:0 0 7px;font-weight:700;break-after:avoid}
  p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;orphans:3;widows:3}
  .section{padding:16px 0 0;break-inside:avoid}.section p{color:#344e59}
  .investment-wrap{padding:18px 0 2px;break-inside:avoid}
  .investment{display:flex;align-items:center;justify-content:space-between;gap:20px;background:#edf5f5;border-left:3px solid #287f89;padding:15px 18px}
  .investment h2{margin:0;font-size:12px}.investment .amount{font-size:28px;line-height:1.2;font-weight:700;letter-spacing:-.5px;color:#226a72;white-space:nowrap;font-variant-numeric:tabular-nums}
  .closing{padding-top:18px;break-inside:avoid}.closing>div{border-top:1px solid #dce6e8;padding-top:13px}.closing h2{color:#226a72}.closing p{color:#344e59}
  .draft{padding-top:12px;font-size:10px;color:#5d7078}
  </style></head><body><main><header><div class="meta"><span class="brand">Prospecta</span><div class="reference">Proposta comercial ${proposalReference(proposal)}<br>Emitida em ${formatProposalDate(proposal.createdAt)}</div></div>${proposal.status === "RASCUNHO" ? '<p class="draft">Rascunho · sujeito a revisão antes do envio</p>' : ""}<div class="parties"><div><p class="label">Preparada para</p><p><strong>${escape(proposal.clientName)}</strong></p>${[
    proposal.clientAddress,
    proposal.clientPhone,
  ]
    .filter(Boolean)
    .map((value) => `<p>${escape(value!)}</p>`)
    .join(
      "",
    )}</div><div><p class="label">Responsável pela proposta</p><p><strong>${escape(proposal.issuerName)}</strong></p><p>${escape(proposal.issuerEmail)}</p></div></div><h1>${escape(proposal.title)}</h1></header>${sections.slice(0, 2).map(renderSection).join("")}<section class="investment-wrap"><div class="investment"><h2>Investimento no projeto</h2><p class="amount">${formatMoney(proposal.total)}</p></div></section>${sections
    .slice(2)
    .map((section, index) => renderSection(section, index + 2))
    .join(
      "",
    )}<section class="closing"><div><h2>Vamos iniciar o projeto?</h2><p>Para aprovar esta proposta e alinhar a contratação, entre em contato com ${escape(proposal.issuerName)} pelo e-mail ${escape(proposal.issuerEmail)}.</p></div></section></main></body></html>`;
}

// Runs only through Playwright's isolated evaluation, never from proposal content.
// Measure at the print width, keep ordinary sections whole, then choose balanced
// breaks for the minimum number of pages. Long free-text sections may continue.
function paginateProposal() {
  const main = document.querySelector("main")!;
  const ruler = document.createElement("div");
  ruler.style.height = "257mm"; // A4 minus the @page top and bottom margins.
  main.append(ruler);
  const capacity = ruler.getBoundingClientRect().height - 2; // Print rounding.
  ruler.remove();
  const blocks = Array.from(main.children) as HTMLElement[];
  if (
    blocks.reduce(
      (sum, block) => sum + block.getBoundingClientRect().height,
      0,
    ) <= capacity
  )
    return;
  const units: HTMLElement[] = [];

  for (const block of blocks) {
    const paragraph = block.querySelector("p");
    if (
      !block.matches(".section") ||
      !paragraph ||
      block.offsetHeight <= capacity * 0.55
    ) {
      units.push(block);
      continue;
    }
    // Split only substantial narrative sections. Binary search uses the actual
    // font metrics, including long words and explicit newlines, with no truncation.
    let remaining = paragraph.textContent!;
    let continuation = false;
    while (remaining.length) {
      const fragment = block.cloneNode(true) as HTMLElement;
      const text = fragment.querySelector("p")!;
      if (continuation) fragment.querySelector("h2")!.append(" (continuação)");
      block.before(fragment);
      let low = 1,
        high = remaining.length,
        fit = 1;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        text.textContent = remaining.slice(0, middle);
        if (fragment.getBoundingClientRect().height <= capacity * 0.28) {
          fit = middle;
          low = middle + 1;
        } else high = middle - 1;
      }
      if (fit < remaining.length) {
        const newline = remaining.lastIndexOf("\n", fit - 1);
        const space = remaining.lastIndexOf(" ", fit - 1);
        const boundary = newline > fit * 0.6 ? newline : space;
        if (boundary > fit * 0.6) fit = boundary + 1;
        // Avoid separating UTF-16 surrogate pairs when a long token must wrap.
        if (/[\uD800-\uDBFF]/.test(remaining[fit - 1])) fit--;
      }
      text.textContent = remaining.slice(0, fit);
      remaining = remaining.slice(fit);
      units.push(fragment);
      continuation = true;
    }
    block.remove();
  }

  const heights = units.map((unit) => unit.getBoundingClientRect().height);
  // Defensive fallback: native print fragmentation still handles an unusually
  // tall identity block rather than clipping or shrinking user information.
  if (heights.some((height) => height > capacity)) return;
  // Continuation headings appear only at the beginning of a new page. Within
  // a page, adjacent fragments read as one section, without repeated labels.
  const discounts = units.map((unit, index) => {
    if (
      !index ||
      !unit.dataset.section ||
      unit.dataset.section !== units[index - 1].dataset.section
    )
      return 0;
    const heading = unit.querySelector("h2")!;
    return (
      heading.getBoundingClientRect().height +
      parseFloat(getComputedStyle(heading).marginBottom) +
      parseFloat(getComputedStyle(unit).paddingTop)
    );
  });
  const sums = [0];
  const discountSums = [0];
  for (const height of heights) sums.push(sums.at(-1)! + height);
  for (const discount of discounts)
    discountSums.push(discountSums.at(-1)! + discount);
  let pageCount = 1,
    used = 0;
  for (let index = 0; index < heights.length; index++) {
    const height = heights[index] - discounts[index];
    if (used + height > capacity) {
      pageCount++;
      used = heights[index];
    } else used += height;
  }
  const count = units.length;
  const costs = Array.from({ length: pageCount + 1 }, () =>
    Array(count + 1).fill(Infinity),
  );
  const breaks = Array.from({ length: pageCount + 1 }, () =>
    Array(count + 1).fill(0),
  );
  costs[0][0] = 0;
  for (let page = 1; page <= pageCount; page++) {
    for (let end = page; end <= count; end++) {
      for (let start = end - 1; start >= page - 1; start--) {
        const height =
          sums[end] -
          sums[start] -
          (discountSums[end] - discountSums[start + 1]);
        if (height > capacity) break;
        // The header stays with the project's objective, never alone on a page.
        if (start === 0 && end === 1 && count > 1) continue;
        const cost = costs[page - 1][start] + (capacity - height) ** 2;
        if (cost < costs[page][end]) {
          costs[page][end] = cost;
          breaks[page][end] = start;
        }
      }
    }
  }
  if (!Number.isFinite(costs[pageCount][count])) return;
  const pages: HTMLElement[][] = [];
  let end = count;
  for (let page = pageCount; page > 0; page--) {
    const start = breaks[page][end];
    pages.unshift(units.slice(start, end));
    end = start;
  }
  main.replaceChildren(
    ...pages.map((children) => {
      const page = document.createElement("div");
      page.className = "pdf-page";
      children.forEach((child, index) => {
        if (
          index &&
          child.dataset.section &&
          child.dataset.section === children[index - 1].dataset.section
        ) {
          child.querySelector("h2")!.remove();
          child.style.paddingTop = "0";
        }
      });
      page.append(...children);
      return page;
    }),
  );
}
let generating = false;
export async function generateProposalPdf(proposal: ProposalDTO) {
  if (generating) throw new Error("PDF_BUSY");
  generating = true;
  let browser:
    | Awaited<ReturnType<(typeof import("playwright"))["chromium"]["launch"]>>
    | undefined;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true, timeout: 15000 });
    const context = await browser.newContext({
      javaScriptEnabled: false,
      serviceWorkers: "block",
    });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    await page.emulateMedia({ media: "print" });
    await page.setContent(proposalPdfHtml(proposal), {
      timeout: 15000,
      waitUntil: "load",
    });
    await page.evaluate(paginateProposal);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        page.pdf({
          format: "A4",
          printBackground: true,
          preferCSSPageSize: true,
          displayHeaderFooter: true,
          headerTemplate: "<span></span>",
          footerTemplate: `<div style="font:9px Arial;color:#5d7078;width:100%;margin:0 18mm;display:flex;justify-content:space-between;border-top:1px solid #dce6e8;padding-top:8px"><span>Prospecta · Proposta ${escape(proposalReference(proposal))}</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("PDF_TIMEOUT")), 15000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  } finally {
    try {
      await browser?.close();
    } finally {
      generating = false;
    }
  }
}
