import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { generateProposalPdf } from "./proposal-pdf";
import { proposalSections } from "./proposal-presentation";
import { formatMoney, type ProposalDTO } from "./proposal.schema";
import { sampleProposal } from "./proposal.test";

// Opt in to the real print engine and Poppler; ordinary unit tests need neither.
test(
  "PDF print layout: short, balanced, extensive and continuous commercial content",
  {
    skip: process.env.PROPOSAL_PDF_TEST !== "1",
    timeout: 120000,
  },
  async (t) => {
    const line =
      "Atividade prevista: análise dos materiais, configuração dos recursos e revisão conjunta das entregas.";
    const examples: { name: string; proposal: ProposalDTO; pages?: number }[] =
      [
        { name: "existente", proposal: sampleProposal, pages: 1 },
        {
          name: "curta",
          pages: 1,
          proposal: {
            ...sampleProposal,
            title: "Consultoria de comunicação",
            description: "Organizar a comunicação da empresa.",
            scope: "Diagnóstico e plano de ação.",
            notes: "Uma rodada de revisão.",
            paymentMode: "A_NEGOCIAR",
            deposit: null,
            depositMethod: null,
            depositInstallments: null,
            balanceMethod: null,
            balanceInstallments: null,
            managedHosting: false,
            monthlyAmount: null,
            maintenance: "",
          },
        },
        {
          name: "equilibrada",
          pages: 2,
          proposal: {
            ...sampleProposal,
            scope: Array.from(
              { length: 14 },
              (_, i) => `${i + 1}. ${line}`,
            ).join("\n"),
            notes: `${line}\nLimite de duas rodadas de alterações. Serviços adicionais dependem de nova proposta.`,
          },
        },
        {
          name: "extensa",
          proposal: {
            ...sampleProposal,
            status: "RASCUNHO",
            title: "Consultoria e implantação de processos de atendimento",
            description: Array(15).fill(line).join(" "),
            scope: Array.from(
              { length: 45 },
              (_, i) => `Entrega ${i + 1}: ${line}`,
            ).join("\n"),
            maintenance: Array(12).fill(line).join("\n"),
            notes: `Limite de duas rodadas de alterações.\n${Array(12).fill(line).join("\n")}`,
          },
        },
        {
          name: "continua",
          proposal: {
            ...sampleProposal,
            description: Array(30).fill(line).join(" "),
            scope: `TextoSemEspacos${"Ábc123".repeat(900)}`,
            clientName: "Empresa com nome extenso ".repeat(5),
            issuerEmail: `${"contato".repeat(20)}@example.invalid`,
            total: "9999999999.99",
            notes:
              "Revisões: 2. Não inclui produção de fotografias.\n\nPrazo condicionado ao envio dos materiais.",
          },
        },
      ];
    const command = (name: string, args: string[], input: Buffer) => {
      const result = spawnSync(name, args, {
        input,
        encoding: "utf8",
        maxBuffer: 5_000_000,
      });
      assert.equal(
        result.status,
        0,
        `${name}: ${result.error || result.stderr}`,
      );
      return result.stdout;
    };
    for (const example of examples)
      await t.test(example.name, async () => {
        const pdf = await generateProposalPdf(example.proposal);
        if (process.env.PROPOSAL_PDF_OUTPUT_DIR) {
          await mkdir(process.env.PROPOSAL_PDF_OUTPUT_DIR, { recursive: true });
          await writeFile(
            `${process.env.PROPOSAL_PDF_OUTPUT_DIR}/${example.name}.pdf`,
            pdf,
          );
        }
        const info = command("pdfinfo", ["-"], pdf);
        const pageCount = Number(info.match(/Pages:\s+(\d+)/)?.[1]);
        if (example.pages) assert.equal(pageCount, example.pages);
        else assert.ok(pageCount >= 3);
        const plain = command("pdftotext", ["-raw", "-", "-"], pdf);
        // Remove repeated continuation labels and running footers before checking
        // the complete stored strings across page boundaries.
        const titles = [
          "Objetivo do projeto",
          "Escopo e entregáveis",
          "Prazo e validade",
          "Condições de pagamento",
          "Hospedagem e manutenção",
          "Observações e condições comerciais",
        ];
        let content = plain.replace(
          /Prospecta · Proposta [A-F0-9]+\s*Página \d+ de \d+/g,
          "",
        );
        for (const title of titles)
          content = content.split(`${title} (continuação)`).join("");
        const compact = (value: string) => value.replace(/\s/g, "");
        for (const text of [
          example.proposal.clientName,
          example.proposal.clientAddress!,
          example.proposal.clientPhone!,
          example.proposal.issuerName,
          example.proposal.issuerEmail,
          example.proposal.title,
          formatMoney(example.proposal.total),
          ...proposalSections(example.proposal).map((section) => section.text),
        ]) {
          assert.ok(
            compact(content).includes(compact(text)),
            `Missing commercial content: ${text.slice(0, 70)}`,
          );
        }
        const bbox = command("pdftotext", ["-bbox", "-", "-"], pdf);
        const bottoms: number[] = [];
        for (const page of bbox.matchAll(/<page\b[^>]*>([\s\S]*?)<\/page>/g)) {
          const words = [
            ...page[1].matchAll(
              /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"/g,
            ),
          ];
          assert.ok(words.length > 10, "No nearly empty page");
          const body = words.filter((word) => Number(word[2]) < 790);
          for (const word of body) {
            assert.ok(
              Number(word[1]) >= 50 && Number(word[3]) <= 545,
              "Horizontal margins",
            );
            assert.ok(
              Number(word[2]) >= 50 && Number(word[4]) <= 780,
              "Vertical margins",
            );
          }
          bottoms.push(Math.max(...body.map((word) => Number(word[4]))));
        }
        assert.equal(bottoms.length, pageCount);
        if (pageCount > 1)
          assert.ok(
            Math.max(...bottoms) - Math.min(...bottoms) < 240,
            `Unbalanced page content: ${bottoms}`,
          );
      });
  },
);
