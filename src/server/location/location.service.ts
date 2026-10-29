import { unstable_cache } from "next/cache";
import { z } from "zod";
import states from "./states.json";
import type { CityDTO, StateDTO } from "./location.dto";

const IBGE_API_URL = "https://servicodados.ibge.gov.br/api/v1/localidades";

const citiesSchema = z
  .array(
    z.object({
      id: z.number().int().positive(),
      nome: z.string().trim().min(1),
    }),
  )
  .nonempty();

export async function fetchCitiesByState(
  stateId: number,
  transport: typeof fetch = fetch,
): Promise<CityDTO[]> {
  const startedAt = Date.now();
  let status: number | undefined;
  try {
    const response = await transport(
      `${IBGE_API_URL}/estados/${stateId}/municipios?orderBy=nome`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );

    status = response.status;
    if (!response.ok) throw new Error("IBGE_HTTP_ERROR");
    const cities = citiesSchema.parse(await response.json());
    if (cities.some((city) => Math.floor(city.id / 100000) !== stateId)) {
      throw new Error("IBGE_INVALID_STATE");
    }

    return cities
      .map((city) => ({
        id: city.id,
        name: city.nome,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  } catch (error: unknown) {
    const cause = error instanceof Error ? error.cause : undefined;
    const code =
      cause && typeof cause === "object" && "code" in cause
        ? String(cause.code)
        : undefined;
    // Intentionally omit payloads, request headers and arbitrary error messages.
    console.warn("[location:ibge] Falha ao carregar municípios", {
      stateId,
      status,
      durationMs: Date.now() - startedAt,
      region: process.env.VERCEL_REGION ?? "local",
      errorType: error instanceof Error ? error.name : "UnknownError",
      code,
    });
    throw new Error(
      "Não foi possível carregar os municípios. Tente novamente.",
    );
  }
}

// Only successfully validated lists enter the persistent Next.js Data Cache.
// Arguments are part of the key, so each UF has its own entry.
const cachedCitiesByState = unstable_cache(
  (stateId: number) => fetchCitiesByState(stateId),
  ["ibge-municipios-v1"],
  { revalidate: 86400 },
);

export class LocationService {
  constructor(private readonly loadCities = cachedCitiesByState) {}

  async listStates(): Promise<StateDTO[]> {
    return states.map((state) => ({ ...state }));
  }

  async listCitiesByState(stateId: number): Promise<CityDTO[]> {
    if (
      !Number.isInteger(stateId) ||
      !states.some((state) => state.id === stateId)
    ) {
      return [];
    }
    return this.loadCities(stateId);
  }
}
