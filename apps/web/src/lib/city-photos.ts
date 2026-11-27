// Local curated photography (public/photos, free-license from Wikimedia
// Commons — see public/photos/CREDITS.md). Cities without a curated photo
// fall back to the Yale campus shot so the hero never renders empty.

const CITY_PHOTOS: Record<string, string> = {
  boston: "boston",
  "new york": "new-york",
  nyc: "new-york",
  chicago: "chicago",
  "san francisco": "san-francisco",
  "los angeles": "los-angeles",
  la: "los-angeles",
  seattle: "seattle",
  denver: "denver",
  "washington dc": "washington-dc",
  washington: "washington-dc",
  miami: "miami",
  philadelphia: "philadelphia",
  atlanta: "atlanta",
  austin: "austin",
  "new haven": "yale-campus",
};

export function cityPhoto(city: string | null | undefined): string {
  const key = (city ?? "").trim().toLowerCase();
  const slug = CITY_PHOTOS[key];
  return `/photos/${slug ?? "yale-campus"}.jpg`;
}
