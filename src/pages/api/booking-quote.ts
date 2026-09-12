import type { APIRoute } from "astro";
import { TRIPS, calculateTripTotal } from "@/data/trips";

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null) as { tripId?: string; travelers?: number } | null;
  const trip = TRIPS.find((item) => item.id === body?.tripId);
  if (!trip) return new Response(JSON.stringify({ error: "Unknown trip" }), { status: 400, headers: { "content-type": "application/json" } });
  return new Response(JSON.stringify(calculateTripTotal(trip, Number(body?.travelers ?? 1))), { headers: { "content-type": "application/json" } });
};
