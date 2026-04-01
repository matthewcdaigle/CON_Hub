/**
 * Geocoding service using OpenStreetMap Nominatim (free, no API key required).
 *
 * Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
 * - Max 1 request per second
 * - Include a descriptive User-Agent header
 */

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const USER_AGENT = "GeorgiaCONHub/1.0 (Certificate of Need Monitoring)";

/** Minimum milliseconds between Nominatim requests. */
const MIN_REQUEST_INTERVAL_MS = 1100;

let lastRequestTime = 0;

/**
 * Wait if necessary to respect Nominatim's rate limit (1 req/sec).
 */
async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed)
    );
  }
  lastRequestTime = Date.now();
}

/**
 * Geocode a US address to latitude/longitude using Nominatim.
 * Returns null if the address cannot be geocoded.
 */
export async function geocodeAddress(
  address: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    await rateLimit();

    const params = new URLSearchParams({
      q: address,
      format: "json",
      countrycodes: "us",
      limit: "1",
      addressdetails: "0",
    });

    const response = await fetch(`${NOMINATIM_BASE_URL}/search?${params}`, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        `Nominatim geocoding failed with status ${response.status}: ${response.statusText}`
      );
      return null;
    }

    const results: Array<{ lat: string; lon: string }> = await response.json();

    if (results.length === 0) {
      console.warn(`Nominatim returned no results for address: "${address}"`);
      return null;
    }

    const { lat, lon } = results[0];
    return {
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
    };
  } catch (error) {
    console.error(`Geocoding error for address "${address}":`, error);
    return null;
  }
}

/**
 * Calculate the distance between two geographic coordinates using the Haversine formula.
 * @returns Distance in miles.
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const EARTH_RADIUS_MILES = 3958.8;

  const toRadians = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_MILES * c;
}
