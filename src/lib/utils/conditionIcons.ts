// =============================================================================
// Libmork — Ícones de condições (SVG em public/assets/conditions)
// Resolve nomes de condição em pt-BR/en para o ícone correspondente.
// Arte de Muttley/foundryvtt-fallout (consentimento Modiphius — ver ATTRIBUTION.txt)
// =============================================================================

const CONDITION_ICON_FILES: Record<string, string> = {
  sangrando: "bleeding",
  sangramento: "bleeding",
  hemorragia: "bleeding",
  bleeding: "bleeding",
  cego: "blind",
  cega: "blind",
  cegueira: "blind",
  blind: "blind",
  blinded: "blind",
  "em chamas": "burning",
  "em fogo": "burning",
  queimando: "burning",
  queimadura: "burning",
  incendiado: "burning",
  burning: "burning",
  morto: "dead",
  morta: "dead",
  morte: "dead",
  dead: "dead",
  surdo: "deaf",
  surda: "deaf",
  surdez: "deaf",
  deaf: "deaf",
  deafened: "deaf",
  doente: "diseased",
  doenca: "diseased",
  enfermo: "diseased",
  diseased: "diseased",
  drogado: "drugged",
  drogada: "drugged",
  quimica: "drugged",
  drugged: "drugged",
  ferido: "injured",
  ferida: "injured",
  machucado: "injured",
  lesionado: "injured",
  injured: "injured",
  wounded: "injured",
  envenenado: "poisoned",
  envenenada: "poisoned",
  veneno: "poisoned",
  intoxicado: "poisoned",
  poisoned: "poisoned",
  caido: "prone",
  caida: "prone",
  derrubado: "prone",
  prostrado: "prone",
  "no chao": "prone",
  prone: "prone",
  irradiado: "radiation",
  irradiada: "radiation",
  radiacao: "radiation",
  radioativo: "radiation",
  radiation: "radiation",
  imobilizado: "restrained",
  imobilizada: "restrained",
  preso: "restrained",
  presa: "restrained",
  agarrado: "restrained",
  amarrado: "restrained",
  restrained: "restrained",
  grappled: "restrained",
  atordoado: "stunned",
  atordoada: "stunned",
  tonto: "stunned",
  tonta: "stunned",
  stunned: "stunned",
  inconsciente: "unconscious",
  desmaiado: "unconscious",
  desmaiada: "unconscious",
  unconscious: "unconscious",
};

function normalizeConditionName(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

export function getConditionIconPath(name: string): string | null {
  const file = CONDITION_ICON_FILES[normalizeConditionName(name)];
  return file ? `/assets/conditions/${file}.svg` : null;
}
