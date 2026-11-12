const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

export interface Place {
  address: string;
  lat: number;
  lng: number;
}

interface NominatimPlace {
  display_name: string;
  lat: string;
  lon: string;
}

const toPlace = (place: NominatimPlace): Place => ({
  address: place.display_name,
  lat: Number(place.lat),
  lng: Number(place.lon),
});

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5', addressdetails: '0' });
  const response = await fetch(`${NOMINATIM_URL}/search?${params}`, { signal, headers: { 'accept-language': 'en' } });
  if (!response.ok) return [];
  return ((await response.json()) as NominatimPlace[]).map(toPlace);
}

export async function placeAt(lat: number, lng: number, signal?: AbortSignal): Promise<Place> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'jsonv2', zoom: '18' });
  const response = await fetch(`${NOMINATIM_URL}/reverse?${params}`, { signal, headers: { 'accept-language': 'en' } });
  const fallback = { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng };
  if (!response.ok) return fallback;
  const place = (await response.json()) as Partial<NominatimPlace>;
  return place.display_name ? { address: place.display_name, lat, lng } : fallback;
}

export const shortAddress = (address: string) => address.split(',').slice(0, 3).join(',').trim();
