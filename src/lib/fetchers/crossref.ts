/**
 * CrossRef：通过 DOI 补全论文元数据（标题、期刊、作者等）。
 */
export interface CrossRefWork {
  title?: string[];
  abstract?: string;
  DOI?: string;
  author?: { given?: string; family?: string }[];
  "container-title"?: string[];
  published?: { "date-parts"?: number[][] };
  subject?: string[];
  type?: string;
}

export async function enrichFromCrossref(doi: string): Promise<Partial<CrossRefWork>> {
  const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "MedPaperPlatform/1.0 (mailto:support@example.com)" },
  });
  if (!res.ok) return {};
  const json = (await res.json()) as { message?: CrossRefWork };
  return json.message ?? {};
}

export function parseCrossrefAuthors(authors?: CrossRefWork["author"]): string[] {
  if (!authors) return [];
  return authors.map((a) => [a.given, a.family].filter(Boolean).join(" "));
}

export function parseCrossrefDate(published?: CrossRefWork["published"]): Date | null {
  const parts = published?.["date-parts"]?.[0];
  if (!parts?.[0]) return null;
  return new Date(parts[0], (parts[1] ?? 1) - 1, parts[2] ?? 1);
}
