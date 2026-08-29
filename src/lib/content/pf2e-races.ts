// =============================================================================
// Libmork — Pathfinder 2e Ancestries / Races Catalog & Data
// =============================================================================

export interface Pf2eRaceDefinition {
  key: string;
  name: string;
  description: string;
  hitPointsBonus: number;
  speed: number;
  size: string;
  attributeBonuses: Record<string, number>;
  languages: string[];
  traits: Array<{ name: string; description?: string }>;
  heritages: Array<{ name: string; description?: string }>;
}

export const PF2E_RACES: Pf2eRaceDefinition[] = [
  {
    key: "dwarf",
    name: "Anão",
    description: "Povo robusto e resoluto moldado nas profundezas das montanhas. Conhecidos por sua habilidade inigualável na forja, canções de pedra ancestrais e determinação inabalável.",
    hitPointsBonus: 10,
    speed: 20,
    size: "Médio",
    attributeBonuses: {
      vigor: 2,
      empatia: 2,
      destreza: -1,
    },
    languages: ["Comum", "Anão"],
    traits: [
      {
        name: "Visão no Escuro",
        description: "Enxerga na escuridão total e na penumbra tão bem quanto na luz plena, em preto e branco.",
      },
      {
        name: "Estabilidade de Pedra",
        description: "Ganha +2 de bônus contra tentativas de empurrar, derrubar ou desestabilizar quando em pé sobre rocha ou solo sólido.",
      },
      {
        name: "Ofício Ancestral",
        description: "Familiaridade inata com a fabricação e avaliação de armas, armaduras e gemas finas.",
      },
    ],
    heritages: [
      {
        name: "Anão da Rocha Viva",
        description: "Sua pele e ossos são densos como granito, concedendo resistência natural a cortes e perfurações.",
      },
      {
        name: "Anão Forja-Fogo",
        description: "Gerações perto das fornalhas conferiram resistência mágica e física a danos de fogo.",
      },
      {
        name: "Anão Guardião da Morte",
        description: "Devotado a purificar tumbas, recebe bônus contra magias necromânticas e efeitos de drenagem de vida.",
      },
      {
        name: "Anão de Escudo Forte",
        description: "Treinado para empunhar e bloquear com escudos pesados com facilidade sobre-humana.",
      },
    ],
  },
  {
    key: "elf",
    name: "Elfo",
    description: "Seres graciosos, longevos e profundamente harmonizados com as correntes de magia primordial e as copas das florestas ancestrais. Movem-se com agilidade etérea.",
    hitPointsBonus: 6,
    speed: 30,
    size: "Médio",
    attributeBonuses: {
      destreza: 2,
      inteligencia: 2,
      vigor: -1,
    },
    languages: ["Comum", "Élfico"],
    traits: [
      {
        name: "Visão na Penumbra",
        description: "Consegue enxergar na luz fraca tão perfeitamente quanto sob a luz solar.",
      },
      {
        name: "Passada Élfica",
        description: "Deslocamento base superior de 30 pés (9 metros) devido à sua fisiologia esbelta e ágil.",
      },
      {
        name: "Transe Meditativo",
        description: "Não dorme no sentido comum; recupera energias com 4 horas de meditação consciente e sonhos despertos.",
      },
    ],
    heritages: [
      {
        name: "Elfo dos Bosques",
        description: "Nativo de florestas densas, ganha bônus em Furtividade e ignora penalidades de terreno difícil natural.",
      },
      {
        name: "Elfo Antigo",
        description: "Sua longevidade prodigiosa permite começar com conhecimentos versáteis de uma classe secundária.",
      },
      {
        name: "Elfo das Cavernas",
        description: "Adaptado a grutas profundas e ruínas subterrâneas, desenvolvendo Visão no Escuro completa.",
      },
      {
        name: "Elfo Sussurrante",
        description: "Audição apurada capaz de detectar o menor farfalhar de folhas ou suspiros à distância.",
      },
    ],
  },
  {
    key: "gnome",
    name: "Gnomo",
    description: "Pequenos seres repletos de entusiasmo, originários do Primeiro Mundo feérico. São movidos por uma curiosidade insaciável para evitar o Desbotamento melancólico.",
    hitPointsBonus: 8,
    speed: 25,
    size: "Pequeno",
    attributeBonuses: {
      vigor: 2,
      empatia: 2,
      forca: -1,
    },
    languages: ["Comum", "Gnômico", "Silvestre"],
    traits: [
      {
        name: "Visão na Penumbra",
        description: "Enxerga perfeitamente em ambientes de baixa luminosidade e luz de velas.",
      },
      {
        name: "Centelha Feérica",
        description: "Conexão inata com magia primal ou ilusória que pulsa através de sua essência.",
      },
      {
        name: "Curiosidade Obsessiva",
        description: "Foco intenso quando investiga novidades, mecanismos desconhecidos ou fenômenos mágicos.",
      },
    ],
    heritages: [
      {
        name: "Gnomo Camaleão",
        description: "Sua pele e cabelos mudam sutilmente de tonalidade para se camuflar no ambiente circundante.",
      },
      {
        name: "Gnomo Sensível a Magia",
        description: "Detecta auras mágicas ao seu redor como um sexto sentido olfativo ou sonoro.",
      },
      {
        name: "Gnomo Vivaz",
        description: "Energia vital transbordante que acelera sua recuperação natural contra venenos e doenças.",
      },
      {
        name: "Gnomo dos Poços",
        description: "Linhagem subterrânea que concede Visão no Escuro e tato apurado nas rochas.",
      },
    ],
  },
  {
    key: "goblin",
    name: "Goblin",
    description: "Criaturas miúdas, hiperativas e inventivas, célebres por suas canções irreverentes, paixão por chamas e uma surpreendente resiliência a quedas e explosões.",
    hitPointsBonus: 6,
    speed: 25,
    size: "Pequeno",
    attributeBonuses: {
      destreza: 2,
      empatia: 2,
      vigor: -1,
    },
    languages: ["Comum", "Goblin"],
    traits: [
      {
        name: "Visão no Escuro",
        description: "Enxerga perfeitamente na escuridão absoluta sem a necessidade de tochas.",
      },
      {
        name: "Agilidade Miúda",
        description: "Capaz de se espremer por passagens apertadas e escapar de agarrões com facilidade acrobática.",
      },
      {
        name: "Improviso Destemido",
        description: "Transforma sucata e tralhas em ferramentas e engenhocas úteis no calor da batalha.",
      },
    ],
    heritages: [
      {
        name: "Goblin Queima-Tudo",
        description: "Resistência inata ao fogo e talento natural para lançar e manipular substâncias incendiárias.",
      },
      {
        name: "Goblin Dente-de-Navalha",
        description: "Presas afiadas como serra que servem como ataque desarmado natural perfurante.",
      },
      {
        name: "Goblin Inquebrável",
        description: "Crânio de ferro e ossos elásticos que reduzem danos causados por quedas e pancadas contundentes.",
      },
      {
        name: "Goblin Couro-Duro",
        description: "Pele calejada que protege contra cortes e espinhos de vegetação rasteira.",
      },
    ],
  },
  {
    key: "halfling",
    name: "Halfling",
    description: "Povo de bom coração, pés ligeiros e sorte legendária. Preferem a tranquilidade do lar ou a estrada aberta em caravanas alegres e acolhedoras.",
    hitPointsBonus: 6,
    speed: 25,
    size: "Pequeno",
    attributeBonuses: {
      destreza: 2,
      empatia: 2,
      forca: -1,
    },
    languages: ["Comum", "Halfling"],
    traits: [
      {
        name: "Sorte dos Halflings",
        description: "Uma vez por sessão ou combate, pode rerrolar um teste de d20 desastroso e ficar com o novo resultado.",
      },
      {
        name: "Coragem Indômita",
        description: "Bônus contra efeitos de pânico, medo e intimidação de criaturas ameaçadoras.",
      },
      {
        name: "Pés Macios",
        description: "Passos silenciosos como brisa, facilitando emboscadas e movimentos furtivos.",
      },
    ],
    heritages: [
      {
        name: "Halfling Destemido",
        description: "Coração bravio que inspira aliados e anula condições de medo rapidamente.",
      },
      {
        name: "Halfling Nômade",
        description: "Viajante experiente que aprende novos idiomas e rotas com facilidade impressionante.",
      },
      {
        name: "Halfling Pés-Leves",
        description: "Extrema agilidade para correr e se esquivar através do espaço ocupado por inimigos maiores.",
      },
      {
        name: "Halfling Oculto",
        description: "Mestre em usar até a menor sombra ou mobília para se esconder da visão alheia.",
      },
    ],
  },
  {
    key: "human",
    name: "Humano",
    description: "A mais adaptável, diversificada e ambiciosa das ancestralidades mortais. Fundam grandes impérios, exploram fronteiras inexploradas e dominam qualquer vocação.",
    hitPointsBonus: 8,
    speed: 25,
    size: "Médio",
    attributeBonuses: {
      forca: 1,
      destreza: 1,
      vigor: 1,
    },
    languages: ["Comum"],
    traits: [
      {
        name: "Versatilidade Natural",
        description: "Ganha uma perícia treinada adicional e um talento de classe ou geral à sua escolha.",
      },
      {
        name: "Ambição Sem Limites",
        description: "Capacidade ímpar de aprender rapidamente novas disciplinas e técnicas avançadas.",
      },
    ],
    heritages: [
      {
        name: "Humano Versátil",
        description: "Flexibilidade extrema em talentos de combate, magia ou sobrevivência geral.",
      },
      {
        name: "Humano Habilidoso",
        description: "Aprende e aprimora múltiplas perícias práticas simultaneamente.",
      },
      {
        name: "Humano Meio-Elfo",
        description: "Herdeiro do sangue élfico, herdando visão na penumbra e graça feérica refinada.",
      },
      {
        name: "Humano Meio-Orc",
        description: "Herdeiro da força orc, recebendo visão no escuro e tenacidade brutal diante da morte.",
      },
    ],
  },
  {
    key: "leshy",
    name: "Léshi",
    description: "Espíritos da natureza imbuídos em corpos vegetais animados por druidas ou rituais primordiais. Curiosos, leais e defensores apaixonados da flora e fauna.",
    hitPointsBonus: 8,
    speed: 25,
    size: "Pequeno",
    attributeBonuses: {
      vigor: 2,
      empatia: 2,
      inteligencia: -1,
    },
    languages: ["Comum", "Silvestre"],
    traits: [
      {
        name: "Visão na Penumbra",
        description: "Percepção refinada em florestas sombrias e noites de luar tênue.",
      },
      {
        name: "Fotossíntese Vegetal",
        description: "Nutre-se primariamente através de luz solar e água limpa em vez de refeições tradicionais.",
      },
      {
        name: "Queda Suave de Folha",
        description: "Pode planar lentamente no ar ao cair, reduzindo qualquer impacto de grandes alturas.",
      },
    ],
    heritages: [
      {
        name: "Léshi Folha",
        description: "Camadas densas de folhagem viva que amortecem quedas e golpes contundentes.",
      },
      {
        name: "Léshi Cacto",
        description: "Corpo coberto por espinhos afiados que devolvem dano perfurante a quem tentar agarrá-lo.",
      },
      {
        name: "Léshi Fungo",
        description: "Gera esporos fosforescentes e ganha Visão no Escuro perfeita em cavernas úmidas.",
      },
      {
        name: "Léshi Flor",
        description: "Pétalas aromáticas que emitem fragrâncias calmantes, melhorando a diplomacia e empatia.",
      },
    ],
  },
  {
    key: "orc",
    name: "Orc",
    description: "Guerreiros imponentes e apaixonados que valorizam a força, a honra em combate e a sobrevivência nas terras mais inóspitas e implacáveis do mundo.",
    hitPointsBonus: 10,
    speed: 25,
    size: "Médio",
    attributeBonuses: {
      forca: 2,
      vigor: 1,
    },
    languages: ["Comum", "Orc"],
    traits: [
      {
        name: "Visão no Escuro",
        description: "Enxerga na escuridão mais densa e subterrânea como se fosse dia.",
      },
      {
        name: "Ferocidade Orc",
        description: "Ao ser reduzido a 0 pontos de vida, pode permanecer de pé com 1 HP por um último ato de heroísmo.",
      },
      {
        name: "Físico Imponente",
        description: "Presença intimidadora natural e capacidade de carga ampliada para carregar fardos pesados.",
      },
    ],
    heritages: [
      {
        name: "Orc Cicatrizado",
        description: "Pele marcada por incontáveis batalhas que concede armadura natural e resistência a ferimentos.",
      },
      {
        name: "Orc das Profundezas",
        description: "Adaptado aos labirintos subterrâneos mais hostis, farejando perigo e minérios.",
      },
      {
        name: "Orc da Fúria",
        description: "Converte sua adrenalina e cólera em dano bruto adicional em ataques corporais.",
      },
      {
        name: "Orc Fera da Selva",
        description: "Agilidade feroz para rastrear presas em pântanos e florestas tropicais fechadas.",
      },
    ],
  },
  {
    key: "catfolk",
    name: "Amurrun (Homem-Gato)",
    description: "Humanoides felinos ágeis, curiosos e elegantes. Valorizam a camaradagem, a busca por segredos ancestrais e a liberdade dos grandes horizontes.",
    hitPointsBonus: 8,
    speed: 25,
    size: "Médio",
    attributeBonuses: {
      destreza: 2,
      empatia: 2,
      vigor: -1,
    },
    languages: ["Comum", "Amurrun"],
    traits: [
      {
        name: "Visão na Penumbra",
        description: "Olhos felinos que capturam os menores feixes de luz na escuridão.",
      },
      {
        name: "Queda de Felino",
        description: "Sempre aterrissa sobre quatro patas, reduzindo severamente o impacto de quedas.",
      },
      {
        name: "Reflexos Predatórios",
        description: "Bônus na iniciativa e velocidade de reação contra ataques surpresa.",
      },
    ],
    heritages: [
      {
        name: "Amurrun Garra-Fina",
        description: "Garras retráteis retráteis afiadas para escalar e rasgar alvos desarmados.",
      },
      {
        name: "Amurrun Caçador da Noite",
        description: "Visão no Escuro completa e passos imperceptíveis na calada da noite.",
      },
      {
        name: "Amurrun Nove-Vidas",
        description: "Sorte milagrosa que o salva de golpes críticos e armadilhas letais.",
      },
      {
        name: "Amurrun da Selva",
        description: "Pelagem camuflada e velocidade de escalada em árvores e penhascos.",
      },
    ],
  },
  {
    key: "kobold",
    name: "Kobold",
    description: "Humanoides reptilianos pequenos que alegam descender de dragões poderosos. Mencionam com orgulho sua afinidade com armadilhas, túneis e magia draconiana.",
    hitPointsBonus: 6,
    speed: 25,
    size: "Pequeno",
    attributeBonuses: {
      destreza: 2,
      empatia: 2,
      vigor: -1,
    },
    languages: ["Comum", "Dracônico"],
    traits: [
      {
        name: "Visão no Escuro",
        description: "Enxerga na escuridão total dos túneis e masmorras.",
      },
      {
        name: "Exemplo Draconiano",
        description: "Inspira-se na imponência dos dragões para resistir ao medo e desferir golpes astutos.",
      },
      {
        name: "Rastejador de Túneis",
        description: "Especialista em rastejar por dutos estreitos e desarmar dispositivos mecânicos.",
      },
    ],
    heritages: [
      {
        name: "Kobold Escama-de-Dragão",
        description: "Escamas coloridas brilhantes que conferem resistência a fogo, gelo, ácido ou eletricidade.",
      },
      {
        name: "Kobold Tocaieiro da Caverna",
        description: "Mestre em emboscadas subterrâneas e armadilhas camufladas no cascalho.",
      },
      {
        name: "Kobold Magia-Venenosa",
        description: "Glândulas venenosas capazes de revestir dardos e adagas com toxinas paralisantes.",
      },
      {
        name: "Kobold Asas-de-Dragão",
        description: "Pequenas asas membranosas funcionais para planar sobre fossos e armadilhas.",
      },
    ],
  },
  {
    key: "ratfolk",
    name: "Povo-Rato (Ysoki)",
    description: "Comerciantes, exploradores e engenheiros engenhosos e gregários. Possuem bochechas expansivas e vivem em comunidades unidas chamadas tocas.",
    hitPointsBonus: 6,
    speed: 25,
    size: "Pequeno",
    attributeBonuses: {
      destreza: 2,
      inteligencia: 2,
      forca: -1,
    },
    languages: ["Comum", "Ysoki"],
    traits: [
      {
        name: "Visão na Penumbra",
        description: "Enxerga na penumbra e ajusta os bigodes para detectar vibrações e correntes de ar.",
      },
      {
        name: "Bolsas nas Bochechas",
        description: "Consegue armazenar até 4 pequenos objetos ou frascos em compartimentos orais especiais.",
      },
      {
        name: "Empatia de Matilha",
        description: "Bônus de coordenação tática quando luta lado a lado com aliados no mesmo espaço.",
      },
    ],
    heritages: [
      {
        name: "Ysoki dos Esgotos",
        description: "Imunidade e alta resistência a doenças infecciosas e toxinas urbanas.",
      },
      {
        name: "Ysoki das Areias",
        description: "Adaptado a desertos quentes, cavando tocas profundas e resistindo à desidratação.",
      },
      {
        name: "Ysoki Roedor de Sombras",
        description: "Pelagem escura e Visão no Escuro refinada para roubos e incursões noturnas.",
      },
      {
        name: "Ysoki Caçador de Pragas",
        description: "Conhecimento enciclopédico de alquimia e eliminação de monstros parasitas.",
      },
    ],
  },
  {
    key: "tengu",
    name: "Tengu",
    description: "Povo humanoide com traços de corvos e pássaros canoros. Famosos pela afinidade com espadas de todos os tipos, colecionismo de relíquias brilhantes e linguagem fluida.",
    hitPointsBonus: 6,
    speed: 25,
    size: "Médio",
    attributeBonuses: {
      destreza: 2,
      empatia: 2,
      vigor: -1,
    },
    languages: ["Comum", "Tengu"],
    traits: [
      {
        name: "Visão na Penumbra",
        description: "Visão aguçada capaz de distinguir alvos camuflados sob luz suave.",
      },
      {
        name: "Ataque de Bico",
        description: "Bico afiado que funciona como arma natural perfurante ágil.",
      },
      {
        name: "Mestre das Lâminas",
        description: "Proficiência instintiva com espadas curtas, sabres, cimitarras e katanas.",
      },
    ],
    heritages: [
      {
        name: "Tengu do Céu Tempestuoso",
        description: "Resistência natural à eletricidade e ventanias fortes.",
      },
      {
        name: "Tengu Olhos-de-Gavião",
        description: "Percepção visual prodigiosa para disparos de precisão a longa distância.",
      },
      {
        name: "Tengu Devorador de Maldições",
        description: "Capacidade mística de absorver e dissipar efeitos mágicos nocivos.",
      },
      {
        name: "Tengu Lâmina-Alada",
        description: "Movimentos rodopiantes com as asas e espadas que confundem as defesas inimigas.",
      },
    ],
  },
  {
    key: "automaton",
    name: "Autômato",
    description: "Construções ancestrais do lendário império de Jistka contendo almas vivas imbuídas em corpos mecânicos de pedra, bronze e energia vital cristalina.",
    hitPointsBonus: 10,
    speed: 25,
    size: "Médio",
    attributeBonuses: {
      forca: 2,
      inteligencia: 1,
    },
    languages: ["Comum", "Jistka"],
    traits: [
      {
        name: "Visão na Penumbra",
        description: "Sensores ópticos cristalinos refinados para operação em baixa luz.",
      },
      {
        name: "Núcleo de Energia Viva",
        description: "Não necessita respirar, comer ou dormir; recarrega seu núcleo em repouso estático.",
      },
      {
        name: "Fisiologia Construta",
        description: "Resistência elevada contra efeitos biológicos, venenos e sangramento contínuo.",
      },
    ],
    heritages: [
      {
        name: "Autômato Blindado",
        description: "Placas maciças de metal forjado que elevam sua classe de armadura natural.",
      },
      {
        name: "Autômato Caçador Ágil",
        description: "Engrenagens reforçadas para aceleração súbita e escalada sobre obstáculos.",
      },
      {
        name: "Autômato Mágico Energizado",
        description: "Canaliza raios de energia mágica concentrada a partir de seu núcleo peitoral.",
      },
      {
        name: "Autômato Guerreiro Titânico",
        description: "Chassi pesado projetado para esmagar muralhas e empunhar armas colossais.",
      },
    ],
  },
  {
    key: "fetchling",
    name: "Fetchling (Kayal)",
    description: "Descendentes de humanos que foram aprisionados no Plano das Sombras e transformados por sua essência crepuscular. Movimentam-se como sombras vivas.",
    hitPointsBonus: 8,
    speed: 25,
    size: "Médio",
    attributeBonuses: {
      destreza: 2,
      empatia: 2,
      vigor: -1,
    },
    languages: ["Comum", "Sombrio"],
    traits: [
      {
        name: "Visão no Escuro",
        description: "Visão profunda através das sombras e trevas mágicas.",
      },
      {
        name: "Manto Crepuscular",
        description: "Resistência natural a dano de frio e efeitos necromânticos sombrios.",
      },
      {
        name: "Passo Sombrio",
        description: "Capaz de se fundir brevemente com as sombras ao se mover.",
      },
    ],
    heritages: [
      {
        name: "Fetchling da Penumbra Profunda",
        description: "Capaz de extinguir pequenas fontes de luz com a mente e desaparecer nas trevas.",
      },
      {
        name: "Fetchling Ladrão de Reflexos",
        description: "Copia a aparência superficial de outras sombras para enganar sentinelas.",
      },
      {
        name: "Fetchling Resiliente das Trevas",
        description: "Recuperação acelerada ao descansar em ambientes imersos em completa escuridão.",
      },
      {
        name: "Fetchling Luz Crepuscular",
        description: "Manipula contraste entre sombras e luz tênue para cegar momentaneamente oponentes.",
      },
    ],
  },
];
