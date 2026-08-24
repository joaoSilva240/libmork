export const SF2E_GITHUB_API = "https://api.github.com/repos/foundryvtt/pf2e/contents";
export const SF2E_GITHUB_TREES_API = "https://api.github.com/repos/foundryvtt/pf2e/git/trees";
export const SF2E_RAW_BASE = "https://raw.githubusercontent.com/foundryvtt/pf2e";
export const SF2E_REF = "v14-dev";
export const SF2E_ICONS_RAW_BASE = `${SF2E_RAW_BASE}/${SF2E_REF}/static/icons`;
export const SF2E_EQUIPMENT_PATH = "packs/pf2e/equipment";
export const SF2E_CATEGORIES = [
  "adventuring-gear", "consumables", "armors", "weapons", "shields"
] as const;

type GithubEntry = { name: string; path: string; type: string; download_url?: string | null };
type GithubTreeEntry = { path: string; type: string; url?: string };
type GithubTreeResponse = { tree?: GithubTreeEntry[]; truncated?: boolean };
type ImageResolution = { original: string | null; resolved: string | null; strategy: string; confidence: number };
export type Sf2eImportItem = {
  name: string; description: string | null; imageUrl: string | null; sourceKey: string;
  sourceData: Record<string, unknown>; category: string;
};

const imageCache = new Map<string, Promise<boolean>>();
const MAX_IMAGE_REQUESTS = 6;
let activeImageRequests = 0;
const imageQueue: Array<() => void> = [];
let iconInventoryPromise: Promise<string[]> | null = null;

async function withImageSlot<T>(operation: () => Promise<T>): Promise<T> {
  if (activeImageRequests >= MAX_IMAGE_REQUESTS) await new Promise<void>((resolve) => imageQueue.push(resolve));
  activeImageRequests++;
  try { return await operation(); } finally {
    activeImageRequests--;
    imageQueue.shift()?.();
  }
}

function normalizeImagePath(value: string): string {
  let path = value.trim().replace(/\\/g, "/").replace(/^\/+/, "").split(/[?#]/)[0];
  for (const prefix of ["systems/sf2e/", "systems/pf2e/", "icons/"]) {
    if (path.startsWith(prefix)) path = path.slice(prefix.length);
  }
  return path.replace(/^\/+/, "");
}

async function isUsableImage(url: string): Promise<boolean> {
  const cached = imageCache.get(url);
  if (cached) return cached;
  const request = withImageSlot(async () => {
    try {
      const response = await fetch(url, { method: "GET", headers: { Accept: "image/*" }, next: { revalidate: 86400 } });
      const type = response.headers.get("content-type")?.toLowerCase() ?? "";
      return response.ok && type.startsWith("image/");
    } catch { return false; }
  });
  imageCache.set(url, request);
  return request;
}

function imageVariants(original: string): string[] {
  const normalized = normalizeImagePath(original);
  const basename = normalized.slice(normalized.lastIndexOf("/") + 1);
  return [...new Set([normalized, original.trim().replace(/\\/g, "/").replace(/^\/+/, "").split(/[?#]/)[0], basename])]
    .filter(Boolean).map((path) => `${SF2E_RAW_BASE}/${SF2E_REF}/static/icons/${path}`);
}

function stemTokens(value: string): string[] {
  const generic = new Set(["item", "items", "equipment", "gear", "weapon", "weapons", "armor", "armors", "the", "a"]);
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase()
    .replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/)
    .filter((token) => token.length > 1 && !generic.has(token));
}

function fuzzyScore(name: string, file: string, category: string, original: string | null): number {
  const wanted = new Set(stemTokens(name));
  const candidate = new Set(stemTokens(file));
  if (!wanted.size || !candidate.size) return 0;
  const overlap = [...wanted].filter((token) => candidate.has(token)).length;
  const jaccard = overlap / new Set([...wanted, ...candidate]).size;
  const categoryHint = `${category}/${original ?? ""}`.toLocaleLowerCase();
  const compatible = categoryHint.split(/[\\/]/).some((part) => file.toLocaleLowerCase().includes(part));
  return jaccard * 0.8 + (compatible ? 0.2 : 0);
}

async function getIconInventory(): Promise<string[]> {
  if (!iconInventoryPromise) {
    iconInventoryPromise = githubJson<GithubTreeResponse>(`${SF2E_GITHUB_TREES_API}/${SF2E_REF}?recursive=1`, 2, "no-store")
      .then((response) => (response.tree ?? []).map((entry) => entry.path)
        .filter((path) => path.startsWith("static/icons/") && /\.(webp|png|jpg)$/i.test(path)))
      .catch(() => []);
  }
  return iconInventoryPromise;
}

async function resolveImage(original: string | null, name: string, category: string): Promise<{ url: string | null; metadata: ImageResolution }> {
  const base: ImageResolution = { original, resolved: null, strategy: "none", confidence: 0 };
  if (original) {
    for (const url of imageVariants(original)) {
      if (await isUsableImage(url)) {
        base.resolved = url; base.strategy = "exact"; base.confidence = 1;
        return { url, metadata: base };
      }
    }
  }
  const files = await getIconInventory();
  const relevant = files.filter((file) => {
    const lower = file.toLocaleLowerCase();
    const originalArea = normalizeImagePath(original ?? "").split("/")[0];
    return lower.includes(category.toLocaleLowerCase()) || (originalArea && lower.includes(originalArea));
  });
  const ranked = (relevant.length ? relevant : files).map((file) => ({ file, score: fuzzyScore(name, file, category, original) }))
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));
  const best = ranked[0];
  const second = ranked[1]?.score ?? 0;
  if (best && best.score >= 0.78 && best.score - second >= 0.08) {
    const url = `${SF2E_RAW_BASE}/${SF2E_REF}/${best.file}`;
    if (await isUsableImage(url)) {
      base.resolved = url; base.strategy = "fuzzy"; base.confidence = Number(best.score.toFixed(3));
      return { url, metadata: base };
    }
  }
  return { url: null, metadata: base };
}

const headers = (): HeadersInit => {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export function formatFoundryText(value: unknown): string {
  if (typeof value === "string") {
    let text = value;

    // Handle JSON wrapper if string is a stringified JSON object/array
    if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
      try {
        const parsed = JSON.parse(text);
        return formatFoundryText(parsed);
      } catch {
        // If JSON parsing fails, continue cleaning
      }
    }

    // Clean up HTML line breaks
    text = text.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>\s*<p>/gi, "\n\n");

    // Clean up HTML tags
    text = text.replace(/<[^>]*>/g, "");

    // Clean up entities
    text = text.replace(/&nbsp;/gi, " ")
               .replace(/&amp;/gi, "&")
               .replace(/&lt;/gi, "<")
               .replace(/&gt;/gi, ">")
               .replace(/&quot;/gi, '"')
               .replace(/&(?:apos|#39);/gi, "'");

    // Clean up inline rolls: [[/r 1d6 #slashing]] or [[/r 1d6]] -> 1d6
    text = text.replace(/\[\[(?:\/(?:r|roll|br|broll)\s+)?([^#\]]+)(?:#[^\]]*)?\]\]/gi, (match, formula) => formula.trim());

    // Clean up UUIDs: @UUID[Compendium.pf2e.equipment-srd.Item.Shortsword]{Espada Curta} -> Espada Curta
    text = text.replace(/(?:\{)?@UUID\[([^\]]+)\](?:\{([^}]+)\})?(w+)?(?:\})?/gi, (match, path, label) => {
      if (label) return label;
      const parts = path.split(".");
      return parts[parts.length - 1] || "";
    });

    // Clean up checks: @Check[type:reflex|dc:15]{reflex save} -> reflex save
    text = text.replace(/(?:\{)?@Check\[([^\]]+)\](?:\{([^}]+)\})?(?:\})?/gi, (match, propsStr, label) => {
      if (label) return label;
      const props = propsStr.split("|");
      const typeProp = props.find((p: string) => p.startsWith("type:"));
      let typeValue = "";
      if (typeProp) {
        typeValue = typeProp.substring(5).trim();
      } else if (props[0]) {
        const first = props[0].trim();
        if (!first.includes(":")) {
          typeValue = first;
        }
      }
      if (typeValue) {
        return typeValue.charAt(0).toUpperCase() + typeValue.slice(1);
      }
      return "Check";
    });

    // Clean up localizes: @Localize[PF2E.WeaponDamageSlashing]
    const localizeMap: Record<string, string> = {
      "PF2E.WeaponDamageSlashing": "corte",
      "PF2E.WeaponDamageBludgeoning": "impacto",
      "PF2E.WeaponDamagePiercing": "perfuração",
      "PF2E.WeaponDamageFire": "fogo",
      "PF2E.WeaponDamageCold": "frio",
      "PF2E.WeaponDamageElectricity": "eletricidade",
      "PF2E.WeaponDamageAcid": "ácido",
      "PF2E.WeaponDamageSonic": "sônico",
      "PF2E.WeaponDamageForce": "força",
      "PF2E.WeaponDamageMental": "mental",
      "PF2E.WeaponDamagePoison": "veneno",
      "PF2E.WeaponDamagePositive": "positivo",
      "PF2E.WeaponDamageNegative": "negativo",
      "PF2E.WeaponDamageVitality": "vitalidade",
      "PF2E.WeaponDamageVoid": "vazio",
    };
    text = text.replace(/(?:\{)?@Localize\[([^\]]+)\](?:\{([^}]+)\})?(?:\})?/gi, (match, key, label) => {
      if (label) return label;
      const trimmedKey = key.trim();
      if (localizeMap[trimmedKey]) return localizeMap[trimmedKey];
      const lastPart = trimmedKey.split(".").pop() || "";
      const cleaned = lastPart.replace(/([A-Z])/g, " $1").trim();
      return cleaned.toLowerCase();
    });

    // Clean up any remaining Foundry tags: {@Tag[Content]} or {@Tag[Content]{Label}} or @Tag[Content]{Label}
    text = text.replace(/(?:\{)?@([a-zA-Z]+)\[([^\]]+)\](?:\{([^}]+)\})?(?:\})?/gi, (match, tag, content, label) => {
      if (label) return label;
      if (tag.toLowerCase() === "damage") {
        return content.split("[")[0].trim();
      }
      return content;
    });

    // Legacy Foundry format fallback cleanups if any exist (e.g. { @UUID ... })
    text = text.replace(/\{@[^ ]+\s+([^}|]+)(?:\|[^}]*)?\}/g, "$1");

    return text.replace(/[ \t]+\n/g, "\n").trim();
  }
  if (Array.isArray(value)) return value.map(formatFoundryText).filter(Boolean).join("\n");
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return formatFoundryText(object.value ?? object.entries ?? object.items ?? "");
  }
  return "";
}

const text = (value: unknown): string | null => { const result = formatFoundryText(value); return result || null; };

export async function mapSf2eItem(raw: unknown, sourceKey: string, categoryOverride?: string): Promise<Sf2eImportItem | null> {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.name !== "string" || !data.name.trim()) return null;

  let category = "equipment";
  if (typeof data.type === "string" && data.type.trim()) {
    category = data.type.trim();
  } else if (categoryOverride) {
    category = categoryOverride;
  }

  const system = data.system && typeof data.system === "object" ? data.system as Record<string, unknown> : {};
  const description = text((system.description as Record<string, unknown> | undefined)?.value);
  const originalImage = typeof data.img === "string" && data.img ? data.img : null;
  const resolved = await resolveImage(originalImage, data.name.trim(), category);

  let damageFormula: string | undefined = undefined;
  let damageType: string | undefined = undefined;
  if (data.type === "weapon" && system.damage && typeof system.damage === "object") {
    const sysDmg = system.damage as Record<string, unknown>;
    if (sysDmg.dice !== undefined && sysDmg.die !== undefined && sysDmg.dice !== null && sysDmg.die !== null) {
      damageFormula = `${sysDmg.dice}${sysDmg.die}`;
    }
    if (typeof sysDmg.damageType === "string") {
      damageType = sysDmg.damageType;
    }
  }

  const sourceData = {
    ...data,
    source: { repository: "foundryvtt/pf2e", ref: SF2E_REF, path: sourceKey, category },
    imageResolution: resolved.metadata,
    ...(damageFormula !== undefined ? { damage: damageFormula } : {}),
    ...(damageType !== undefined ? { damageType } : {})
  };
  return { name: data.name.trim(), description, imageUrl: resolved.url,
    sourceKey, category, sourceData };
}

function githubError(response: Response): Error {
  const rateLimited = response.status === 403 || response.status === 429 || response.headers.get("x-ratelimit-remaining") === "0";
  return new Error(`GitHub ${response.status} (${rateLimited ? "limite de requisições" : response.statusText})`);
}

async function githubJson<T>(url: string, retries = 2, cacheOption: RequestCache = "default"): Promise<T> {
  const fetchOptions: RequestInit = { headers: headers() };
  if (cacheOption === "no-store") {
    fetchOptions.cache = "no-store";
  } else {
    fetchOptions.next = { revalidate: 3600 };
  }
  const response = await fetch(url, fetchOptions);
  if (!response.ok) {
    const rateLimited = response.status === 403 || response.status === 429 || response.headers.get("x-ratelimit-remaining") === "0";
    if (rateLimited && retries > 0) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : (3 - retries) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return githubJson<T>(url, retries - 1, cacheOption);
    }
    throw githubError(response);
  }
  return response.json() as Promise<T>;
}

async function filesFromRecursiveTree(): Promise<GithubEntry[]> {
  const response = await githubJson<GithubTreeResponse>(`${SF2E_GITHUB_TREES_API}/${SF2E_REF}?recursive=1`, 2, "no-store");
  if (response.truncated) {
    throw new Error("Git Trees API retornou uma árvore truncada; usando fallback por pasta");
  }
  const prefix = `${SF2E_EQUIPMENT_PATH}/`;
  return (response.tree ?? [])
    .filter((entry) => entry.type === "blob" && entry.path.startsWith(prefix) && entry.path.endsWith(".json") && !entry.path.endsWith("/_folders.json") && !entry.path.includes("/", prefix.length))
    .map((entry) => ({ name: entry.path.slice(entry.path.lastIndexOf("/") + 1), path: entry.path, type: "file" }));
}

async function loadFlatFiles(files: GithubEntry[], failures: Array<{ category: string; error: string }>): Promise<Sf2eImportItem[]> {
  const loaded: Sf2eImportItem[] = [];
  for (let offset = 0; offset < files.length; offset += 6) {
    const batch = files.slice(offset, offset + 6);
    const values = await Promise.all(batch.map(async (file) => {
      try {
        const raw = await githubJson(`${SF2E_RAW_BASE}/${SF2E_REF}/${file.path}`);
        return mapSf2eItem(raw, file.path);
      } catch (error) {
        const message = error instanceof Error ? error.message : "JSON inválido";
        failures.push({ category: "equipment", error: `${file.name}: ${message}` });
        return null;
      }
    }));
    loaded.push(...values.filter((item): item is Sf2eImportItem => item !== null));
  }
  return loaded;
}

export async function fetchSf2eItems(onError?: (category: string, error: string) => void): Promise<{ items: Sf2eImportItem[]; failures: Array<{ category: string; error: string }> }> {
  const items: Sf2eImportItem[] = [], failures: Array<{ category: string; error: string }> = [];

  let files: GithubEntry[] | null = null;
  try {
    files = await filesFromRecursiveTree();
  } catch (error) {
    const message = error instanceof Error ? error.message : "inventário GitHub indisponível";
    console.warn(`SF2e: ${message}. Fallback Contents API.`);
  }

  if (!files) {
    try {
      const entries = await githubJson<GithubEntry[]>(`${SF2E_GITHUB_API}/${SF2E_EQUIPMENT_PATH}?ref=${SF2E_REF}`);
      files = entries.filter((entry) => entry.type === "file" && entry.name.endsWith(".json") && entry.name !== "_folders.json");
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro ao listar pasta SF2E_EQUIPMENT_PATH";
      failures.push({ category: "equipment", error: message });
      onError?.("equipment", message);
    }
  }

  if (files && files.length > 0) {
    items.push(...await loadFlatFiles(files, failures));
    const equipmentFailures = failures.filter((failure) => failure.category === "equipment");
    if (equipmentFailures.length) {
      onError?.("equipment", `${equipmentFailures.length} arquivo(s) falharam`);
    }
  }

  return { items, failures };
}