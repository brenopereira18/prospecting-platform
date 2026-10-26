import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/src/server/auth/current-user.service";
import { ProposalService } from "@/src/server/proposals/proposal.service";
import { generateProposalPdf } from "@/src/server/proposals/proposal-pdf";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (!user)
    return Response.json(
      { error: "Faça login para baixar a proposta." },
      { status: 401, headers },
    );
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return Response.json(
      { error: "Proposta não encontrada." },
      { status: 404, headers },
    );
  const row = await prisma.commercialProposal.findFirst({
    where: { id, userId: user.id, lead: { userId: user.id } },
    select: { leadId: true },
  });
  if (!row)
    return Response.json(
      { error: "Proposta não encontrada." },
      { status: 404, headers },
    );
  try {
    const proposal = await new ProposalService(prisma).get(
      id,
      row.leadId,
      user.id,
    );
    const buffer = await generateProposalPdf(proposal);
    return new Response(new Uint8Array(buffer), {
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="proposta-${id}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PDF_BUSY")
      return Response.json(
        {
          error:
            "Outra proposta está sendo gerada. Tente novamente em instantes.",
        },
        { status: 429, headers },
      );
    console.error("Falha ao gerar PDF da proposta.", error);
    return Response.json(
      { error: "Não foi possível gerar o PDF. Tente novamente." },
      { status: 503, headers },
    );
  }
}
