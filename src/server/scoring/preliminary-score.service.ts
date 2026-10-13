export interface PreliminaryScoreInput {
  website: string | null;
  phone: string | null;
  rating: number | null;
  userRatingCount: number;
}

export interface PreliminaryScoreResult {
  total: number;
  breakdown: {
    website: number;
    phone: number;
    reviewCount: number;
    rating: number;
  };
}

export class PreliminaryScoreService {
  calculate(input: PreliminaryScoreInput): number {
    return this.calculateDetailed(input).total;
  }

  calculateDetailed(input: PreliminaryScoreInput): PreliminaryScoreResult {
    const breakdown = {
      website: this.calculateWebsiteScore(input.website),
      phone: this.calculatePhoneScore(input.phone),
      reviewCount: this.calculateReviewCountScore(input.userRatingCount),
      rating: this.calculateRatingScore(input.rating),
    };

    const total =
      breakdown.website +
      breakdown.phone +
      breakdown.reviewCount +
      breakdown.rating;

    return {
      total,
      breakdown,
    };
  }

  private calculateWebsiteScore(website: string | null): number {
    return website ? 0 : 45;
  }

  private calculatePhoneScore(phone: string | null): number {
    return phone ? 25 : 0;
  }

  private calculateReviewCountScore(reviewCount: number): number {
    if (reviewCount <= 10) {
      return 0;
    }

    if (reviewCount <= 50) {
      return 4;
    }

    if (reviewCount <= 150) {
      return 8;
    }

    if (reviewCount <= 500) {
      return 12;
    }

    if (reviewCount <= 1000) {
      return 16;
    }

    return 20;
  }

  private calculateRatingScore(rating: number | null): number {
    if (rating === null || rating < 3.5) {
      return 0;
    }

    if (rating < 4) {
      return 3;
    }

    if (rating < 4.5) {
      return 6;
    }

    return 10;
  }
}
