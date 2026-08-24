export const PF2E_TRAITS_PT: Record<string, string> = {
  agile: "Ágil",
  attached: "Acoplada",
  backstabber: "Traiçoeira",
  backswing: "Retorno",
  brutal: "Brutal",
  clockwork: "Mecânico",
  clumsy: "Desajeitada",
  concealable: "Ocultável",
  concussive: "Concussiva",
  deadly: "Mortal",
  disarm: "Desarmar",
  double: "Dupla",
  fatal: "Fatal",
  finesse: "Acuidade",
  forceful: "Forte",
  freehand: "Mão Livre",
  grapple: "Agarrar",
  invested: "Investido",
  jousting: "Justa",
  kickback: "Coice",
  light: "Leve",
  magical: "Mágico",
  nonlethal: "Não-Letal",
  parry: "Aparar",
  propulsive: "Propulsiva",
  ranged: "À Distância",
  reach: "Alcance",
  repeating: "Repetição",
  shove: "Empurrar",
  sweep: "Varrer",
  tethered: "Amarrada",
  thrown: "Arremesso",
  trip: "Derrubar",
  twin: "Gêmea",
  twohand: "Duas Mãos",
  "two-hand": "Duas Mãos",
  unarmed: "Desarmado",
  versatile: "Versátil",
  volley: "Salva",
};

export const PF2E_DAMAGE_TYPES_PT: Record<string, string> = {
  bludgeoning: "impacto",
  piercing: "perfuração",
  slashing: "corte",
  acid: "ácido",
  cold: "frio",
  electricity: "eletricidade",
  fire: "fogo",
  sonic: "sônico",
  force: "força",
  mental: "mental",
  poison: "veneno",
  void: "vazio",
  vitality: "vitalidade",
  untyped: "sem tipo",
};

export const PF2E_CATEGORIES_PT: Record<string, string> = {
  unarmed: "desarmado",
  simple: "simples",
  martial: "marcial",
  advanced: "avançado",
  light: "leve",
  medium: "médio",
  heavy: "pesado",
  shield: "escudo",
};

export const PF2E_GROUPS_PT: Record<string, string> = {
  axe: "machado",
  bow: "arco",
  brawling: "briga",
  club: "clava",
  crossbow: "besta",
  dart: "dardo",
  flail: "flagelo",
  hammer: "martelo",
  knife: "faca",
  pick: "picareta",
  polearm: "arma de haste",
  shield: "escudo",
  sling: "funda",
  spear: "lança",
  sword: "espada",
  firearm: "arma de fogo",
  bomb: "bomba",
};

export const PF2E_USAGE_PT: Record<string, string> = {
  "held-in-one-hand": "empunhado com uma mão",
  "held-in-two-hands": "empunhado com duas mãos",
  "held-in-one-or-two-hands": "empunhado com uma ou duas mãos",
  worn: "vestido",
  wornarmor: "vestido (armadura)",
  "worn-armor": "vestido (armadura)",
  wornshield: "vestido (escudo)",
  "worn-shield": "vestido (escudo)",
  wornclothing: "vestido (roupas)",
  "worn-clothing": "vestido (roupas)",
  wornfootwear: "vestido (calçados)",
  "worn-footwear": "vestido (calçados)",
  worngloves: "vestido (luvas)",
  "worn-gloves": "vestido (luvas)",
  wornheadwear: "vestido (elmo/chapéu)",
  "worn-headwear": "vestido (elmo/chapéu)",
  wornnecklace: "vestido (colar)",
  "worn-necklace": "vestido (colar)",
  wornring: "vestido (anel)",
  "worn-ring": "vestido (anel)",
  wornbelt: "vestido (cinto)",
  "worn-belt": "vestido (cinto)",
  wornbracers: "vestido (braceletes)",
  "worn-bracers": "vestido (braceletes)",
  worncloak: "vestido (capa)",
  "worn-cloak": "vestido (capa)",
  "attached-to-shield": "acoplado ao escudo",
  "attached-to-crossbow-or-firearm": "acoplado a uma besta/arma de fogo",
};

export function formatPrice(price: unknown, lang: "pt" | "en" = "pt"): string {
  if (price === null || price === undefined) return "";
  
  if (typeof price === "number") {
    return lang === "pt" ? `${price} PO` : `${price} gp`;
  }
  
  if (typeof price === "string") {
    const trimmed = price.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return formatPrice(parsed, lang);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  
  if (typeof price === "object") {
    let valueObj = price as Record<string, unknown>;
    if (valueObj.value && typeof valueObj.value === "object") {
      valueObj = valueObj.value as Record<string, unknown>;
    }
    
    const parts: string[] = [];
    const units = lang === "pt"
      ? { pp: "PE", gp: "PO", sp: "PP", cp: "PC" }
      : { pp: "pp", gp: "gp", sp: "sp", cp: "cp" };
      
    const order: Array<"pp" | "gp" | "sp" | "cp"> = ["pp", "gp", "sp", "cp"];
    let hasAny = false;
    for (const key of order) {
      if (valueObj[key] !== undefined && valueObj[key] !== null) {
        hasAny = true;
        const val = Number(valueObj[key]);
        if (!isNaN(val) && val > 0) {
          parts.push(`${val} ${units[key]}`);
        }
      }
    }
    
    if (parts.length > 0) {
      return parts.join(", ");
    }
    
    if (hasAny) {
      for (const key of order) {
        if (valueObj[key] !== undefined && valueObj[key] !== null) {
          return `0 ${units[key]}`;
        }
      }
    }
    
    return "";
  }
  
  return String(price);
}

export function formatDamage(damage: unknown, lang: "pt" | "en" = "pt"): string {
  if (damage === null || damage === undefined) return "";
  
  if (typeof damage === "string") {
    const trimmed = damage.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return formatDamage(parsed, lang);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  
  if (typeof damage === "object") {
    let target = damage as Record<string, unknown>;
    if (target.value && typeof target.value === "object") {
      target = target.value as Record<string, unknown>;
    }
    
    const dice = target.dice !== undefined && target.dice !== null ? String(target.dice) : "";
    const die = target.die !== undefined && target.die !== null ? String(target.die) : "";
    
    let formula = "";
    if (dice && die) {
      formula = `${dice}${die}`;
    } else if (die) {
      formula = die;
    } else if (dice) {
      formula = dice;
    }
    
    const damageType = target.damageType;
    if (!damageType) {
      return formula;
    }
    
    const typeStr = String(damageType).trim().toLowerCase();
    if (lang === "pt") {
      const translated = PF2E_DAMAGE_TYPES_PT[typeStr] || typeStr;
      return formula ? `${formula} de ${translated}` : `de ${translated}`;
    } else {
      return formula ? `${formula} ${typeStr}` : typeStr;
    }
  }
  
  return String(damage);
}

export function formatTraits(traits: unknown, lang: "pt" | "en" = "pt"): string {
  if (traits === null || traits === undefined) return "";
  
  let list: unknown[] = [];
  if (Array.isArray(traits)) {
    list = traits;
  } else if (typeof traits === "string") {
    const trimmed = traits.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        return formatTraits(parsed, lang);
      } catch {
        return trimmed;
      }
    }
    list = trimmed.split(",").map(t => t.trim()).filter(Boolean);
  } else if (typeof traits === "object") {
    const traitsObj = traits as Record<string, unknown>;
    if (Array.isArray(traitsObj.value)) {
      list = traitsObj.value;
    } else if (traitsObj.value !== undefined && traitsObj.value !== null) {
      return formatTraits(traitsObj.value, lang);
    } else {
      const keys = Object.keys(traitsObj);
      if (keys.length > 0 && keys.every(k => typeof traitsObj[k] === "boolean")) {
        list = keys.filter(k => traitsObj[k]);
      } else {
        list = Object.values(traitsObj);
      }
    }
  }
  
  const mapped = list.map(item => {
    const str = typeof item === "object" && item !== null && "value" in item
      ? String((item as Record<string, unknown>).value).trim()
      : String(item).trim();
    if (lang === "pt") {
      const lower = str.toLowerCase();
      return PF2E_TRAITS_PT[lower] || str;
    }
    return str;
  });
  
  return mapped.filter(Boolean).join(", ");
}

export function formatCategory(category: unknown, lang: "pt" | "en" = "pt"): string {
  if (category === null || category === undefined) return "";
  let valStr = "";
  if (typeof category === "object") {
    const catObj = category as Record<string, unknown>;
    valStr = catObj.value !== undefined && catObj.value !== null ? String(catObj.value) : JSON.stringify(category);
  } else {
    valStr = String(category);
  }
  valStr = valStr.trim();
  if (lang === "pt") {
    const lower = valStr.toLowerCase();
    return PF2E_CATEGORIES_PT[lower] || valStr;
  }
  return valStr;
}

export function formatGroup(group: unknown, lang: "pt" | "en" = "pt"): string {
  if (group === null || group === undefined) return "";
  let valStr = "";
  if (typeof group === "object") {
    const grpObj = group as Record<string, unknown>;
    valStr = grpObj.value !== undefined && grpObj.value !== null ? String(grpObj.value) : JSON.stringify(group);
  } else {
    valStr = String(group);
  }
  valStr = valStr.trim();
  if (lang === "pt") {
    const lower = valStr.toLowerCase();
    return PF2E_GROUPS_PT[lower] || valStr;
  }
  return valStr;
}

export function formatUsage(usage: unknown, lang: "pt" | "en" = "pt"): string {
  if (usage === null || usage === undefined) return "";
  let valStr = "";
  if (typeof usage === "object") {
    const useObj = usage as Record<string, unknown>;
    valStr = useObj.value !== undefined && useObj.value !== null ? String(useObj.value) : JSON.stringify(usage);
  } else {
    valStr = String(usage);
  }
  valStr = valStr.trim();
  if (lang === "pt") {
    const lower = valStr.toLowerCase();
    return PF2E_USAGE_PT[lower] || valStr;
  }
  return valStr;
}

export function formatTechnicalField(key: string, value: unknown, lang: "pt" | "en" = "pt"): string {
  if (value === null || value === undefined) return "";
  
  const normKey = key.trim().toLowerCase();
  
  switch (normKey) {
    case "price":
      return formatPrice(value, lang);
    case "damage":
      return formatDamage(value, lang);
    case "traits":
      return formatTraits(value, lang);
    case "category":
      return formatCategory(value, lang);
    case "group":
      return formatGroup(value, lang);
    case "usage":
      return formatUsage(value, lang);
    default: {
      let extracted: unknown = value;
      if (value !== null && typeof value === "object") {
        const valObj = value as Record<string, unknown>;
        if ("value" in valObj) {
          extracted = valObj.value;
        } else {
          return typeof value === "object" ? JSON.stringify(value) : String(value);
        }
      }
      if (extracted === null || extracted === undefined) return "";
      
      if (typeof extracted === "string") {
        const trimmed = extracted.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          try {
            const parsed = JSON.parse(trimmed);
            return formatTechnicalField(key, parsed, lang);
          } catch {
            // ignore and return trimmed
          }
        }
        return trimmed;
      }
      return String(extracted);
    }
  }
}

export function getTechnicalLabel(key: string, lang: "pt" | "en" = "pt"): string {
  const norm = key.trim().toLowerCase();
  const labels: Record<string, Record<"pt" | "en", string>> = {
    level: { pt: "Nível", en: "Level" },
    price: { pt: "Preço", en: "Price" },
    bulk: { pt: "Bulk/Peso", en: "Bulk" },
    quantity: { pt: "Quantidade", en: "Quantity" },
    usage: { pt: "Uso", en: "Usage" },
    category: { pt: "Categoria", en: "Category" },
    group: { pt: "Grupo", en: "Group" },
    damage: { pt: "Dano", en: "Damage" },
    traits: { pt: "Traços", en: "Traits" },
    ac: { pt: "CA", en: "AC" },
    resiliency: { pt: "Resistências", en: "Resiliency" },
  };
  return labels[norm]?.[lang] || key;
}
