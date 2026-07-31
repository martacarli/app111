import axios from 'axios';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

export function formatLocationLabel(address) {
  if (!address) return null;
  const label =
    address.suburb ||
    address.neighbourhood ||
    address.city_district ||
    address.city ||
    address.town ||
    address.village ||
    address.country ||
    null;
  return label;
}

export async function reverseGeocode(lat, lng, { httpClient = axios } = {}) {
  try {
    const response = await httpClient.get(NOMINATIM_URL, {
      params: { format: 'jsonv2', lat, lon: lng },
      headers: { 'User-Agent': 'SafeLoopRun/0.1 (contact: app support)' },
    });
    const label = formatLocationLabel(response.data?.address);
    return { label, raw: response.data };
  } catch (err) {
    return { label: null, raw: null };
  }
}
