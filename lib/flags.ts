/**
 * Country list + flag helpers for guest origins.
 *
 * The country is stored as a lowercase ISO 3166-1 alpha-2 code (e.g. "de").
 * Flags come from flagcdn.com — it covers every country and loads instantly in
 * the browser, so there is no local asset to ship. We pick the country from a
 * fixed list in the office, so there is no free-text matching to get wrong.
 */

export type Country = { code: string; name: string }

// A broad but practical list, ordered by how likely the charter is to see them
// (European source markets first), then the rest alphabetically by name.
export const COUNTRIES: Country[] = [
  { code: 'de', name: 'Germany' },
  { code: 'at', name: 'Austria' },
  { code: 'ch', name: 'Switzerland' },
  { code: 'fr', name: 'France' },
  { code: 'it', name: 'Italy' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'ie', name: 'Ireland' },
  { code: 'es', name: 'Spain' },
  { code: 'pt', name: 'Portugal' },
  { code: 'nl', name: 'Netherlands' },
  { code: 'be', name: 'Belgium' },
  { code: 'lu', name: 'Luxembourg' },
  { code: 'si', name: 'Slovenia' },
  { code: 'hr', name: 'Croatia' },
  { code: 'cz', name: 'Czechia' },
  { code: 'sk', name: 'Slovakia' },
  { code: 'pl', name: 'Poland' },
  { code: 'hu', name: 'Hungary' },
  { code: 'dk', name: 'Denmark' },
  { code: 'se', name: 'Sweden' },
  { code: 'no', name: 'Norway' },
  { code: 'fi', name: 'Finland' },
  { code: 'is', name: 'Iceland' },
  { code: 'ee', name: 'Estonia' },
  { code: 'lv', name: 'Latvia' },
  { code: 'lt', name: 'Lithuania' },
  { code: 'gr', name: 'Greece' },
  { code: 'ro', name: 'Romania' },
  { code: 'bg', name: 'Bulgaria' },
  { code: 'rs', name: 'Serbia' },
  { code: 'ua', name: 'Ukraine' },
  { code: 'ru', name: 'Russia' },
  { code: 'us', name: 'United States' },
  { code: 'ca', name: 'Canada' },
  { code: 'mx', name: 'Mexico' },
  { code: 'br', name: 'Brazil' },
  { code: 'ar', name: 'Argentina' },
  { code: 'za', name: 'South Africa' },
  { code: 'mg', name: 'Madagascar' },
  { code: 'mu', name: 'Mauritius' },
  { code: 're', name: 'Réunion' },
  { code: 'au', name: 'Australia' },
  { code: 'nz', name: 'New Zealand' },
  { code: 'cn', name: 'China' },
  { code: 'jp', name: 'Japan' },
  { code: 'kr', name: 'South Korea' },
  { code: 'in', name: 'India' },
  { code: 'ae', name: 'United Arab Emirates' },
  { code: 'il', name: 'Israel' },
  { code: 'tr', name: 'Turkey' },
]

const NAME_BY_CODE: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c.name]),
)

/** flagcdn image at ~20px tall; displayed smaller, so it stays crisp. */
export function flagUrl(code: string): string {
  return `https://flagcdn.com/h40/${code.toLowerCase()}.png`
}

/** Human country name for a stored code, or "" when unknown/empty. */
export function countryName(code: string | null | undefined): string {
  if (!code) return ''
  return NAME_BY_CODE[code.toLowerCase()] ?? ''
}
