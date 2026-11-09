import { describe, it, expect } from "vitest";
import { buildCloneValues } from "../character-share-service";

const source = {
  id: "char-source",
  ownerId: "owner-1",
  classId: "class-1",
  raceId: "race-1",
  activeHeritages: ["heritage-a"],
  name: "Artemis",
  imageUrl: "https://cdn.libmork.dev/artemis.png",
  description: "Caçadora das sombras de Barovia.",
  hitPointsMax: 25,
  hitPointsCurrent: 7,
  manaPointsMax: 15,
  manaPointsCurrent: 0,
  attributes: { forca: 10, destreza: 14, vigor: 12, inteligencia: 9, empatia: 8, sorte: 11 },
  level: 5,
  xp: 42,
  block: 3,
  deathStatus: "dying",
  deathSuccesses: 2,
  deathFailures: 1,
  coins: { bronze: 10, prata: 5, ouro: 2, platina: 0, diamante: 1 },
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-06-01T00:00:00Z"),
};

describe("buildCloneValues (duplicação de personagem — Issue #79)", () => {
  const clone = buildCloneValues(source as never, "owner-2");

  it("atribui o novo dono e copia identidade e progressão", () => {
    expect(clone.ownerId).toBe("owner-2");
    expect(clone.name).toBe("Artemis");
    expect(clone.classId).toBe("class-1");
    expect(clone.raceId).toBe("race-1");
    expect(clone.activeHeritages).toEqual(["heritage-a"]);
    expect(clone.attributes).toEqual(source.attributes);
    expect(clone.level).toBe(5);
    expect(clone.xp).toBe(42);
    expect(clone.block).toBe(3);
    expect(clone.description).toBe("Caçadora das sombras de Barovia.");
    expect(clone.imageUrl).toBe(source.imageUrl);
  });

  it("copia moedas integralmente", () => {
    expect(clone.coins).toEqual(source.coins);
  });

  it("restaura vitais ao máximo e zera estado de morte", () => {
    expect(clone.hitPointsCurrent).toBe(clone.hitPointsMax);
    expect(clone.manaPointsCurrent).toBe(clone.manaPointsMax);
    expect(clone.deathStatus).toBe("alive");
    expect(clone.deathSuccesses).toBe(0);
    expect(clone.deathFailures).toBe(0);
  });

  it("não carrega id, timestamps nem vínculos do original", () => {
    expect(clone).not.toHaveProperty("id");
    expect(clone).not.toHaveProperty("createdAt");
    expect(clone).not.toHaveProperty("updatedAt");
    expect(clone).not.toHaveProperty("campaignId");
  });
});
