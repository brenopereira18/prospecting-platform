export interface EstablishmentCandidateDTO {
  placeId: string;
  name: string;
  phone: string | null;
  rating: number | null;
  userRatingCount: number;
  website: string | null;
  address: string;
  openingHours: string[];
  score: number;
  isRegistered?: boolean;
}

export interface GooglePlace {
  id: string;
  displayName?: {
    text: string;
  };
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  formattedAddress?: string;
  regularOpeningHours?: {
    weekdayDescriptions?: string[];
  };
}

export interface GoogleTextSearchResponse {
  places?: GooglePlace[];
  nextPageToken?: string;
}
