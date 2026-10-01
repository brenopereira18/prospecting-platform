interface PreliminaryScoreInput {
  website: string | null;
  phone: string | null;
  rating: number | null;
  userRatingCount: number;
}

export class PreliminaryScoreService {
  calculate(input: PreliminaryScoreInput): number {
    let score = 0;

    score += this.calculateWebsiteScore(input.website);
    score += this.calculatePhoneScore(input.phone);
    score += this.calculateReviewCountScore(input.userRatingCount);
    score += this.calculateRatingScore(input.rating);

    return score;
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
