import axios from 'axios';

const POLICE_API_BASE = 'https://data.police.uk/api/crimes-street/all-crime';

// data.police.uk publishes with a lag, so the most recent 1-2 months
// usually 404. Start a couple of months back and walk further back from there.
export function buildMonthSequence(referenceDate, maxMonthsBack = 6) {
  const months = [];
  let year = referenceDate.getUTCFullYear();
  let month = referenceDate.getUTCMonth() + 1; // 1-indexed

  // Skip the 2 most recent months (likely unpublished).
  for (let i = 0; i < 2; i++) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }

  for (let i = 0; i < maxMonthsBack; i++) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }

  return months;
}

export function normalizeCrimeRecord(raw) {
  return {
    id: raw.id ?? null,
    category: raw.category ?? 'other-crime',
    latitude: parseFloat(raw.location?.latitude),
    longitude: parseFloat(raw.location?.longitude),
    month: raw.month ?? null,
  };
}

export function dedupeCrimes(crimes) {
  const seen = new Set();
  const result = [];
  for (const crime of crimes) {
    const key =
      crime.id !== null && crime.id !== undefined
        ? `id:${crime.id}`
        : `composite:${crime.category}|${crime.month}|${crime.latitude?.toFixed(5)}|${crime.longitude?.toFixed(5)}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(crime);
    }
  }
  return result;
}

export async function fetchCrimeData(
  lat,
  lng,
  { maxMonthsBack = 6, monthsToAggregate = 3, httpClient = axios } = {}
) {
  const months = buildMonthSequence(new Date(), maxMonthsBack);
  const collected = [];
  let successfulMonths = 0;

  for (const month of months) {
    if (successfulMonths >= monthsToAggregate) break;
    try {
      const response = await httpClient.get(POLICE_API_BASE, {
        params: { lat, lng, date: month },
      });
      successfulMonths += 1;
      if (Array.isArray(response.data)) {
        collected.push(...response.data.map(normalizeCrimeRecord));
      }
    } catch (err) {
      // 404 = month not published yet; skip it and keep walking back.
      if (err.response?.status !== 404) {
        throw err;
      }
    }
  }

  return dedupeCrimes(collected);
}
