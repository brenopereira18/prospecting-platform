import { NextRequest, NextResponse } from "next/server";

const GOOGLE_PLACES_PHOTO_URL = "https://places.googleapis.com/v1";

export async function GET(request: NextRequest) {
  const photoName = request.nextUrl.searchParams.get("name");

  if (!photoName) {
    return NextResponse.json(
      { message: "Referência da foto não informada." },
      { status: 400 },
    );
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { message: "GOOGLE_PLACES_API_KEY não está configurada." },
      { status: 500 },
    );
  }

  const photoUrl =
    `${GOOGLE_PLACES_PHOTO_URL}/${photoName}/media` +
    `?maxWidthPx=600&maxHeightPx=400&key=${apiKey}`;

  const response = await fetch(photoUrl);

  if (!response.ok) {
    return NextResponse.json(
      { message: "Não foi possível carregar a foto." },
      { status: response.status },
    );
  }

  const image = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? "image/jpeg";

  return new NextResponse(image, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
