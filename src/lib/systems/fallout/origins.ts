// =============================================================================
// Libmork — Sistema Fallout 2d20: Origens de Personagem
// Descrições adaptadas (pt-BR) do livro de regras oficial da Modiphius,
// com referência ao criador comunitário github.com/MichaelData (sem licença).
// =============================================================================

import type { FalloutAttribute, FalloutOrigin, FalloutSkillName } from "./types";

export interface FalloutOriginConfig {
  id: FalloutOrigin;
  label: string;
  source: string;
  description: string;
  traitName: string;
  traitDescription: string;
  /** Tags extras concedidas pela origem (além das 3 padrão) */
  bonusTags: number;
  /** Tags extras que devem vir de uma lista restrita (vazia = livre) */
  bonusTagOptions: FalloutSkillName[];
  /** Limites máximos de atributo impostos pela origem */
  attributeLimits: Partial<Record<FalloutAttribute, number>>;
  /** Bônus iniciais de atributo concedidos pela origem */
  attributeBonuses: Partial<Record<FalloutAttribute, number>>;
  /** Rank máximo de perícia (vazio = sem limite, padrão 6) */
  maxSkillRank?: number;
  /** Concede percepção 360°: -1 de dificuldade em testes de PER visuais/olfativos */
  robot: boolean;
  /** Carga fixa em lb (robôs não usam FOR para carga) */
  fixedCarryWeight?: number;
}

export const FALLOUT_ORIGIN_CONFIGS: Record<FalloutOrigin, FalloutOriginConfig> = {
  vault_dweller: {
    id: "vault_dweller",
    label: "Morador de Refúgio (Vault Dweller)",
    source: "Livro de Regras, p.57",
    description:
      "Você vem de um Refúgio subterrâneo da Vault-Tec. Mais saudável e melhor educado que a maioria dos habitantes dos ermos, mas também mais isolado do mundo exterior.",
    traitName: "Criança do Refúgio (Vault Kid)",
    traitDescription:
      "Reduz em 1 a dificuldade de testes de RES para resistir a doenças. Você recebe 1 Tag Skill adicional à sua escolha. Uma vez por missão, o Mestre pode introduzir uma complicação ligada ao experimento do seu Refúgio ou ao seu isolamento; quando isso ocorre, você recupera 1 Ponto de Sorte.",
    bonusTags: 1,
    bonusTagOptions: [],
    attributeLimits: {},
    attributeBonuses: {},
    robot: false,
  },
  wastelander: {
    id: "wastelander",
    label: "Habitante dos Ermos (Wastelander)",
    source: "Livro de Regras, p.56",
    description:
      "O legado vivo daqueles que se prepararam por conta própria para o Armagedom. Você só está vivo porque seus antepassados cavaram, se esconderam e sobreviveram.",
    traitName: "Traços dos Ermos (Wastelander Traits)",
    traitDescription:
      "Escolha dois traços da lista de Habitante dos Ermos (Educado, Tiro Rápido, Dotado, Punho Pesado, Estrutura Pequena).",
    bonusTags: 0,
    bonusTagOptions: [],
    attributeLimits: {},
    attributeBonuses: {},
    robot: false,
  },
  brotherhood_initiate: {
    id: "brotherhood_initiate",
    label: "Iniciado da Irmandade do Aço",
    source: "Livro de Regras, p.51",
    description:
      "Nascido das terríveis revelações da Rebelião de Mariposa, você é dedicado à preservação da tecnologia e à missão da Irmandade do Aço.",
    traitName: "A Corrente que Une (The Chain that Binds)",
    traitDescription:
      "Você recebe 1 Tag Skill adicional, que deve ser Armas de Energia, Ciência ou Reparos. Você deve obedecer às ordens de seus superiores, sob risco de ser expulso e ter sua tecnologia confiscada.",
    bonusTags: 1,
    bonusTagOptions: ["energy_weapons", "science", "repair"],
    attributeLimits: {},
    attributeBonuses: {},
    robot: false,
  },
  ghoul: {
    id: "ghoul",
    label: "Necrótico (Ghoul)",
    source: "Livro de Regras, p.52",
    description:
      "Pós-humanos necróticos, imunes à radiação. Envelhecem lentamente e carregam o peso da discriminação dos 'peles-lisas'.",
    traitName: "Pós-Humano Necrótico (Necrotic Post-Human)",
    traitDescription:
      "Imune a dano de radiação — e curado por ele (1 PV a cada 3 de dano de Rad). Sobrevivência torna-se Tag Skill (+2 ranks). Envelhecimento lento, estéril. Testes de CAR sofrem discriminação de peles-lisas.",
    bonusTags: 0,
    bonusTagOptions: [],
    attributeLimits: {},
    attributeBonuses: {},
    robot: false,
  },
  super_mutant: {
    id: "super_mutant",
    label: "Super Mutante",
    source: "Livro de Regras, p.53",
    description:
      "Infectado pelo V.F.E. (Vírus de Evolução Forçada), você é uma máquina de matar massiva e musculosa. Incrivelmente forte e resistente, mas frequentemente carente de inteligência ou carisma.",
    traitName: "Evolução Forçada (Forced Evolution)",
    traitDescription:
      "FOR e RES iniciais +2 (máx. 12). INT e CAR máximos 6. Nenhuma perícia acima de rank 4. Imune a dano de radiação e veneno. Estéril; armaduras precisam ser adaptadas a um super mutante.",
    bonusTags: 0,
    bonusTagOptions: [],
    attributeLimits: { int: 6, cha: 6, str: 12, end: 12 },
    attributeBonuses: { str: 2, end: 2 },
    maxSkillRank: 4,
    robot: false,
  },
  mister_handy: {
    id: "mister_handy",
    label: "Mister Handy",
    source: "Livro de Regras, p.54",
    description:
      "Um robô General Atomics confiável, com programação de personalidade distinta e três braços utilitários.",
    traitName: "Robô Mister Handy (Mister Handy Robot)",
    traitDescription:
      "Visão de 360° (-1 de dificuldade em testes de PER visuais/olfativos). Imune a radiação e veneno. Não usa químicos, comida, bebida ou repouso. Movimentação flutuante. Carga fixa de 150 lb. Curado apenas por reparos.",
    bonusTags: 0,
    bonusTagOptions: [],
    attributeLimits: {},
    attributeBonuses: {},
    robot: true,
    fixedCarryWeight: 150,
  },
  survivor: {
    id: "survivor",
    label: "Sobrevivente",
    source: "Livro de Regras, p.56",
    description:
      "Um habitante comum dos ermos que aprendeu a sobreviver dia após dia, seja caçando, negociando ou esquivando-se de perigos.",
    traitName: "Traços de Sobrevivente",
    traitDescription:
      "Escolha dois traços da lista de Sobrevivente (Educado, Tiro Rápido, Dotado, Punho Pesado, Estrutura Pequena).",
    bonusTags: 0,
    bonusTagOptions: [],
    attributeLimits: {},
    attributeBonuses: {},
    robot: false,
  },
};

export const FALLOUT_ORIGIN_LIST: FalloutOriginConfig[] = [
  FALLOUT_ORIGIN_CONFIGS.vault_dweller,
  FALLOUT_ORIGIN_CONFIGS.wastelander,
  FALLOUT_ORIGIN_CONFIGS.brotherhood_initiate,
  FALLOUT_ORIGIN_CONFIGS.ghoul,
  FALLOUT_ORIGIN_CONFIGS.super_mutant,
  FALLOUT_ORIGIN_CONFIGS.mister_handy,
  FALLOUT_ORIGIN_CONFIGS.survivor,
];
