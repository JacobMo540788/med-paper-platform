import { sleep } from "../utils";

export interface CrossRefWork {
  title?: string[];
  abstract?: string;
  DOI?: string;
  author?: { given?: string; family?: string }[];
  "container-title"?: string[];
  published?: { "date-parts"?: number[][] };
  subject?: string[];
  type?: string;
  ISSN?: string[];
}

const workCache = new Map<string, Partial<CrossRefWork>>();

export function normalizeDoi(doi?: string | null): string | undefined {
  if (!doi) return undefined;
  return doi
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .toLowerCase();
}

export async function enrichFromCrossref(doi: string): Promise<Partial<CrossRefWork>> {
  const normalized = normalizeDoi(doi);
  if (!normalized) return {};
  if (workCache.has(normalized)) return workCache.get(normalized)!;

  const mailto = process.env.CROSSREF_MAILTO ?? process.env.NCBI_EMAIL ?? "support@example.com";
  const url = `https://api.crossref.org/works/${encodeURIComponent(normalized)}`;
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": `MedFrontier/1.0 (mailto:${mailto})`,
        },
      });
      if (res.status === 404) {
        workCache.set(normalized, {});
        return {};
      }
      if (!res.ok) {
        lastError = new Error(`Crossref ${res.status}: ${await res.text()}`);
        if (![429, 500, 502, 503, 504].includes(res.status)) break;
      } else {
        const json = (await res.json()) as { message?: CrossRefWork };
        const work = json.message ?? {};
        workCache.set(normalized, work);
        return work;
      }
    } catch (error) {
      lastError = error;
    }
    await sleep((attempt + 1) * 900);
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function parseCrossrefAuthors(authors?: CrossRefWork["author"]): string[] {
  if (!authors) return [];
  return authors.map((a) => [a.given, a.family].filter(Boolean).join(" ")).filter(Boolean);
}

export function parseCrossrefDate(published?: CrossRefWork["published"]): Date | null {
  const parts = published?.["date-parts"]?.[0];
  if (!parts?.[0]) return null;
  return new Date(parts[0], (parts[1] ?? 1) - 1, parts[2] ?? 1);
}

export function stripCrossrefMarkup(value?: string): string | undefined {
  return value?.replace(/<\/?jats:[^>]+>/g, "").replace(/<[^>]+>/g, "").trim();
}
