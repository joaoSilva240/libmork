// =============================================================================
// Libmork — Sistema MISSING — Edição ZERO: Tipos de Domínio
// Horror Analógico e Investigação Minimalista
// =============================================================================

/** Papel do participante na mesa de jogo */
export type Role = "voice" | "writer";

/** Estado de existência do habitante */
export type HabitantStatus = "active" | "missing";

/** Linha individual do Registro de Habitante (folha A4 pautada) */
export interface HabitantLine {
  id: string;
  index: number;
  text: string;
  isErased: boolean;
  erasedAt?: string;
  erasedReason?: string;
}

/** Estado de integridade do equipamento */
export type EquipmentStatus = "active" | "lost";

/** Equipamento inicial do Habitante (equivalente a post-it individual) */
export interface MissingEquipment {
  id: string;
  slot: 1 | 2 | 3;
  name: string;
  notes?: string;
  status: EquipmentStatus;
  lostReason?: string;
}

/** Entidade principal do Habitante em MISSING */
export interface MissingHabitant {
  id: string;
  campaignId: string;
  ownerId: string;
  name: string;
  status: HabitantStatus;
  lines: HabitantLine[];
  equipments: [MissingEquipment, MissingEquipment, MissingEquipment];
  createdAt: string;
  updatedAt: string;
}

/** Classificação do teste solicitado pela Voz */
export type TestType = "common" | "probable" | "improbable";

/** Desfecho binário da rolagem (1-3: Perda, 4-6: Ganho) */
export type DiceOutcome = "gain" | "loss";

/** Resultado da resolução de um teste */
export interface TestResult {
  type: TestType;
  dice: number[];
  selectedDie: number;
  supportBonus: number;
  effectiveTotal: number;
  outcome: DiceOutcome;
  details: string;
}

/** Resultado de forçar um teste arriscando equipamento */
export interface ForcedTestResult {
  originalResult: TestResult;
  forcedDie: number;
  equipmentUsedId: string;
  newSelectedDie: number;
  effectiveTotal: number;
  outcome: DiceOutcome;
  equipmentLost: boolean;
  details: string;
}

/** Nível de perigo de uma ameaça (1, 2 ou 3) */
export type DangerLevel = 1 | 2 | 3;

/** Ameaça presente na cena */
export interface MissingThreat {
  id: string;
  name: string;
  description?: string;
  dangerLevel: DangerLevel;
}

/** Cena ativa em MISSING */
export interface MissingScene {
  id: string;
  campaignId: string;
  title: string;
  isActive: boolean;
  threats: MissingThreat[];
}

/** Tipos de conexões da Teia de Investigação */
export type ConnectionType = "cause" | "origin" | "perspective";

/** Pista de investigação física (post-it) */
export interface MissingClue {
  id: string;
  campaignId: string;
  title: string;
  description: string;
  isFalseClue: boolean;
  deliveredToHabitantId: string | null;
  createdAt: string;
}

/** Conexão entre duas pistas na Teia de Investigação */
export interface InvestigationConnection {
  id: string;
  campaignId: string;
  sourceClueId: string;
  targetClueId: string;
  type: ConnectionType;
  explanation?: string;
  createdAt: string;
}

/** Efeito escolhido ao concretizar uma Epifania */
export type EpiphanyEffect = "tear_false_clue" | "answer_question" | "deliver_new_clue";

/** Teia de Investigação contendo todas as conexões */
export interface InvestigationWeb {
  connections: InvestigationConnection[];
}

/** Estado agregado da campanha de MISSING */
export interface MissingCampaignState {
  id: string;
  campaignId: string;
  activeScene: MissingScene;
  cluesBank: MissingClue[];
  investigationWeb: InvestigationWeb;
  epiphanyHistory: EpiphanyRecord[];
  createdAt: string;
  updatedAt: string;
  role?: Role;
}

/** Registro histórico de Epifania concretizada */
export interface EpiphanyRecord {
  id: string;
  campaignId: string;
  stage: number;
  chosenEffect: EpiphanyEffect;
  notes?: string;
  createdAt: string;
}

/** Tipos de eventos auditáveis do livro-razão / histórico narrativo */
export type LedgerEventType =
  | "TEST_ROLLED"
  | "TEST_FORCED"
  | "LINE_ERASED"
  | "EQUIPMENT_LOST"
  | "CLUE_CREATED"
  | "CLUE_DELIVERED"
  | "CONNECTION_MADE"
  | "EPIPHANY_DECLARED"
  | "THREAT_ADDED"
  | "THREAT_REDUCED"
  | "THREAT_REMOVED";

/** Evento do livro-razão narrativo */
export interface LedgerEvent {
  id: string;
  campaignId: string;
  habitantId?: string;
  actorRole: Role;
  actorId: string;
  eventType: LedgerEventType;
  payload: Record<string, unknown>;
  timestamp: string;
}

/** Definição de item da tabela de equipamentos 2d6 */
export interface EquipmentItemDefinition {
  name: string;
  description: string;
}

/** Tabela oficial de equipamentos 2d6 (Manual MISSING — Edição ZERO, pág. 9) */
export const EQUIPMENT_TABLE_2D6: Record<number, EquipmentItemDefinition> = {
  2: {
    name: "Rolo de Filme",
    description: "Com imagens do passado",
  },
  3: {
    name: "Gravador de Áudio",
    description: "Com as últimas palavras de alguém",
  },
  4: {
    name: "Canivete Militar",
    description: "Que você achou revirando memórias",
  },
  5: {
    name: "Lanterna",
    description: "Que pisca na presença do mal",
  },
  6: {
    name: "Amuleto religioso",
    description: "De uma fé que não te pertence mais",
  },
  7: {
    name: "Documentos de identificação",
    description: "Falsos",
  },
  8: {
    name: "Caderno",
    description: "Com anotações confusas sobre o futuro",
  },
  9: {
    name: "Câmera Filmadora",
    description: "Que já gravou coisas terríveis",
  },
  10: {
    name: "Revólver",
    description: "Que quase te matou",
  },
  11: {
    name: "Pé de Cabra",
    description: "Que você roubou de alguém",
  },
  12: {
    name: "Chaves",
    description: "De algum lugar próximo",
  },
} as const;
