export interface EstablishmentCandidateDTO {
  placeId: string;
  name: string;
  phone: string | null;
  rating: number | null;
  userRatingCount: number;
  photoName: string | null;
  website: string | null;
  address: string;
  openingHours: string[];
}

export interface GooglePlace {
  id: string;
  displayName?: {
    text: string;
  };
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  photos?: GooglePlacePhoto[];
  websiteUri?: string;
  formattedAddress?: string;
  regularOpeningHours?: {
    weekdayDescriptions?: string[];
  };
}

export interface GooglePlacePhoto {
  name: string;
}

export interface GoogleTextSearchResponse {
  places?: GooglePlace[];
  nextPageToken?: string;
}
