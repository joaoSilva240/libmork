const PF2E_TREE_URL = "https://api.github.com/repos/foundryvtt/pf2e/git/trees/v14-dev?recursive=1";
const PF2E_SPELLS_CONTENT_URL = "https://api.github.com/repos/foundryvtt/pf2e/contents/static/icons/spells?ref=v14-dev";
export const PF2E_SPELL_ICON_BASE_URL =
  "https://raw.githubusercontent.com/foundryvtt/pf2e/v14-dev/static/icons/spells/";

type GithubTreeEntry = { path?: unknown; type?: unknown };
type GithubContentEntry = { name?: unknown; type?: unknown };

export function spellNameToSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function levenshtein(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const above = previous[j];
      previous[j] = left[i - 1] === right[j - 1]
        ? diagonal
        : Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + 1);
      diagonal = above;
    }
  }
  return previous[right.length];
}

/** Resolves only against the supplied official file names; never invents an asset URL. */
export function resolvePf2eSpellIcon(name: string, fileNames: readonly string[]): string | null {
  const slug = spellNameToSlug(name);
  if (!slug) return null;
  const candidates = fileNames
    .filter((file) => file.toLowerCase().endsWith(".webp"))
    .map((file) => ({ file, slug: spellNameToSlug(file.slice(0, -5)) }))
    .filter((candidate) => candidate.slug);
  const exact = candidates.find((candidate) => candidate.slug === slug);
  if (exact) return `${PF2E_SPELL_ICON_BASE_URL}${encodeURIComponent(exact.file)}`;

  const ranked = candidates
    .map((candidate) => {
      const distance = levenshtein(slug, candidate.slug);
      return { ...candidate, distance, similarity: 1 - distance / Math.max(slug.length, candidate.slug.length) };
    })
    .sort((a, b) => b.similarity - a.similarity || a.file.localeCompare(b.file));
  const best = ranked[0];
  const second = ranked[1];
  if (!best) return null;
  const safeDistance = slug.length <= 8 && best.distance <= 2;
  const safeSimilarity = best.similarity >= 0.86;
  const unambiguous = !second || best.similarity - second.similarity > 0.02;
  if ((!safeDistance && !safeSimilarity) || !unambiguous) return null;
  return `${PF2E_SPELL_ICON_BASE_URL}${encodeURIComponent(best.file)}`;
}

export async function fetchPf2eSpellIconFiles(): Promise<string[]> {
  const response = await fetch(PF2E_TREE_URL, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error(`ícones PF2e HTTP ${response.status}`);
  const tree = await response.json() as { truncated?: boolean; tree?: GithubTreeEntry[] };
  if (!tree.truncated) {
    return (tree.tree ?? [])
      .filter((entry) => entry.type === "blob" && typeof entry.path === "string" && /^static\/icons\/spells\/[^/]+\.webp$/i.test(entry.path))
      .map((entry) => (entry.path as string).split("/").pop() as string);
  }

  // A truncated recursive tree is unsafe. The contents endpoint is paginable and folder-scoped.
  const files: string[] = [];
  for (let page = 1; ; page++) {
    const pageResponse = await fetch(`${PF2E_SPELLS_CONTENT_URL}&per_page=100&page=${page}`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!pageResponse.ok) throw new Error(`ícones PF2e HTTP ${pageResponse.status}`);
    const entries = await pageResponse.json() as GithubContentEntry[];
    files.push(...entries.filter((entry) => entry.type === "file" && typeof entry.name === "string" && entry.name.toLowerCase().endsWith(".webp")).map((entry) => entry.name as string));
    if (entries.length < 100) return files;
  }
}
