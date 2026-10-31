import { MasterOpd } from "@/types/database";

/**
 * Normalizes text for comparison by lowercasing and stripping non-alphanumeric chars
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts acronym from a string (e.g., "Badan Penanggulangan Bencana Daerah" -> "bpbd")
 */
function getAcronym(str: string): string {
  const words = normalize(str).split(" ").filter(w => !["prov", "provinsi", "kaltim", "dan", "yang"].includes(w));
  return words.map(w => w[0]).join("");
}

/**
 * Calculates similarity score between search query and an OPD
 */
export function calculateOpdMatchScore(rawQuery: string, opd: MasterOpd): number {
  if (!rawQuery) return 0;

  const query = normalize(rawQuery);
  // Punctuation-only input (e.g. "-") normalizes to "", which would match every OPD via includes("")
  if (!query) return 0;
  const username = normalize(opd.username_jigd || "");
  const opdName = normalize(opd.nama_opd || "");

  // Exact matches
  if (query === username || query === opdName) return 1.0;

  // Username containment (e.g., "bpbd" in "bpbdkaltim", "dishut" in "dishutkaltim")
  if (username) {
    if (username.startsWith(query) || username.includes(query)) return 0.95;
    if (query.includes(username)) return 0.9;
  }

  // Acronym match on OPD name (e.g., "bpbd" matches acronym of "Badan Penanggulangan Bencana Daerah")
  const acronym = getAcronym(opdName);
  if (query === acronym || acronym.includes(query)) return 0.92;
  if (username && getAcronym(username) === query) return 0.92;

  // Name containment (e.g. "kehutanan" in "dinas kehutanan provinsi kalimantan timur")
  if (opdName.includes(query)) return 0.85;

  // Word token overlap
  const queryTokens = query.split(" ").filter(t => t.length > 2);
  const opdTokens = opdName.split(" ").filter(t => t.length > 2);
  let matchedTokens = 0;

  for (const q of queryTokens) {
    if (opdTokens.some(o => o.includes(q) || q.includes(o))) {
      matchedTokens++;
    }
  }

  if (queryTokens.length > 0 && matchedTokens > 0) {
    const tokenScore = (matchedTokens / queryTokens.length) * 0.8;
    return tokenScore;
  }

  return 0;
}

/**
 * Finds best matching OPD for a given producer name from CSV
 */
export function findBestOpdMatch(producerName: string, opds: MasterOpd[]): { opd: MasterOpd | null; score: number } {
  if (!producerName || !opds.length) return { opd: null, score: 0 };

  let bestOpd: MasterOpd | null = null;
  let bestScore = 0;

  for (const opd of opds) {
    const score = calculateOpdMatchScore(producerName, opd);
    if (score > bestScore) {
      bestScore = score;
      bestOpd = opd;
    }
  }

  // Threshold for acceptable auto-match
  if (bestScore >= 0.5) {
    return { opd: bestOpd, score: bestScore };
  }

  return { opd: null, score: bestScore };
}
