// Coarse US metro centroids for browser-geolocation → city resolution.
// Deliberately small and local: no external geocoding dependency, and the
// demo's seeded cities are all covered. Unknown coords return null and the
// caller falls back to manual city entry — coordinates themselves are never
// persisted anywhere.

export type Metro = { city: string; lat: number; lng: number; radiusKm: number };

export const METROS: Metro[] = [
  { city: "New York", lat: 40.7128, lng: -74.006, radiusKm: 60 },
  { city: "Boston", lat: 42.3601, lng: -71.0589, radiusKm: 50 },
  { city: "Chicago", lat: 41.8781, lng: -87.6298, radiusKm: 60 },
  { city: "San Francisco", lat: 37.7749, lng: -122.4194, radiusKm: 50 },
  { city: "Los Angeles", lat: 34.0522, lng: -118.2437, radiusKm: 80 },
  { city: "Washington DC", lat: 38.9072, lng: -77.0369, radiusKm: 50 },
  { city: "Seattle", lat: 47.6062, lng: -122.3321, radiusKm: 50 },
  { city: "Philadelphia", lat: 39.9526, lng: -75.1652, radiusKm: 50 },
  { city: "Atlanta", lat: 33.749, lng: -84.388, radiusKm: 60 },
  { city: "Austin", lat: 30.2672, lng: -97.7431, radiusKm: 50 },
  { city: "Denver", lat: 39.7392, lng: -104.9903, radiusKm: 60 },
  { city: "Miami", lat: 25.7617, lng: -80.1918, radiusKm: 60 },
  { city: "New Haven", lat: 41.3083, lng: -72.9279, radiusKm: 25 },
  { city: "San Diego", lat: 32.7157, lng: -117.1611, radiusKm: 50 },
  { city: "Dallas", lat: 32.7767, lng: -96.797, radiusKm: 70 },
  { city: "Houston", lat: 29.7604, lng: -95.3698, radiusKm: 70 },
  { city: "Minneapolis", lat: 44.9778, lng: -93.265, radiusKm: 50 },
  { city: "Portland", lat: 45.5152, lng: -122.6784, radiusKm: 50 },
  { city: "Nashville", lat: 36.1627, lng: -86.7816, radiusKm: 50 },
  { city: "Pittsburgh", lat: 40.4406, lng: -79.9959, radiusKm: 40 },
  { city: "Detroit", lat: 42.3314, lng: -83.0458, radiusKm: 50 },
  { city: "Phoenix", lat: 33.4484, lng: -112.074, radiusKm: 70 },
  { city: "St. Louis", lat: 38.627, lng: -90.1994, radiusKm: 50 },
  { city: "Baltimore", lat: 39.2904, lng: -76.6122, radiusKm: 40 },
  { city: "Providence", lat: 41.824, lng: -71.4128, radiusKm: 30 },
  { city: "Raleigh", lat: 35.7796, lng: -78.6382, radiusKm: 50 },
  { city: "Salt Lake City", lat: 40.7608, lng: -111.891, radiusKm: 50 },
  { city: "Las Vegas", lat: 36.1699, lng: -115.1398, radiusKm: 40 },
  { city: "New Orleans", lat: 29.9511, lng: -90.0715, radiusKm: 40 },
  { city: "Charlotte", lat: 35.2271, lng: -80.8431, radiusKm: 50 },
];

function haversineKm(a: { lat: number; lng: number }, b: Metro) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Nearest metro within its radius, or null (→ caller uses manual fallback).
export function nearestMetro(lat: number, lng: number): string | null {
  let best: { city: string; dist: number } | null = null;
  for (const m of METROS) {
    const dist = haversineKm({ lat, lng }, m);
    if (dist <= m.radiusKm && (!best || dist < best.dist)) {
      best = { city: m.city, dist };
    }
  }
  return best?.city ?? null;
}
