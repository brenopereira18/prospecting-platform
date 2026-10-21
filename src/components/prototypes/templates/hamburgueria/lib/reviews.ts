import type { HamburgueriaPrototypeDocument } from "../schema/hamburgueria.schema";
import { publicWebUrl } from "./presentation";

/** Missing provenance in older documents is treated conservatively in demos. */
export function getReviewSummaryNotice(
  document: HamburgueriaPrototypeDocument,
): string {
  const { reviews } = document.content;
  const fallback = "demo";
  const rating = reviews.ratingSource ?? fallback;
  const count = reviews.countSource ?? fallback;
  if (rating === count) {
    return {
      demo: "Resumo de avaliações ilustrativo",
      lead: "Resumo de avaliações do lead",
      provided: "Resumo informado pelo estabelecimento",
    }[rating];
  }
  return rating === "demo" || count === "demo"
    ? "Resumo parcialmente ilustrativo · revise a nota e a contagem"
    : "Resumo com dados do lead e do estabelecimento";
}

export function hasConfirmedReviewSummary(
  document: HamburgueriaPrototypeDocument,
): boolean {
  const reviews = document.content.reviews;
  return (
    reviews.count > 0 &&
    (reviews.ratingSource === "lead" || reviews.ratingSource === "provided") &&
    (reviews.countSource === "lead" || reviews.countSource === "provided")
  );
}

export function confirmedReviews(document: HamburgueriaPrototypeDocument) {
  return document.content.reviews.entries.filter(
    (review) =>
      review.demonstrative === false &&
      (!review.sourceUrl?.trim() || publicWebUrl(review.sourceUrl)),
  );
}
