import { describe, it, expect } from "vitest";
import {
  createChatMessageSchema,
  createPollInputSchema,
  votePollSchema,
  shareInputSchema,
  createDmSchema,
  updateMemberPermissionsSchema,
  removeCampaignMemberSchema,
} from "../chat";

describe("Chat & Polls Validators (Issue #62)", () => {
  describe("createChatMessageSchema", () => {
    it("valida mensagem de texto simples", () => {
      const result = createChatMessageSchema.safeParse({
        content: "Olá grupo da campanha!",
        type: "text",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe("Olá grupo da campanha!");
        expect(result.data.type).toBe("text");
      }
    });

    it("rejeita mensagem com texto vazio", () => {
      const result = createChatMessageSchema.safeParse({
        content: "   ",
        type: "text",
      });
      expect(result.success).toBe(false);
    });

    it("valida mensagem com enquete anexa", () => {
      const result = createChatMessageSchema.safeParse({
        content: "Enquete de agendamento",
        type: "poll",
        poll: {
          title: "Qual o melhor dia para a sessão?",
          options: ["Sábado 19h", "Domingo 15h"],
          isMultipleChoice: true,
        },
      });
      expect(result.success).toBe(true);
      if (result.success && result.data.poll) {
        expect(result.data.poll.options).toHaveLength(2);
        expect(result.data.poll.isMultipleChoice).toBe(true);
      }
    });
  });

  describe("createPollInputSchema", () => {
    it("rejeita enquete com menos de 2 opções", () => {
      const result = createPollInputSchema.safeParse({
        title: "Pergunta válida",
        options: ["Apenas uma"],
      });
      expect(result.success).toBe(false);
    });

    it("rejeita enquete com pergunta muito curta", () => {
      const result = createPollInputSchema.safeParse({
        title: "A",
        options: ["Opção 1", "Opção 2"],
      });
      expect(result.success).toBe(false);
    });

    it("rejeita mais de 10 opções", () => {
      const options = Array.from({ length: 11 }, (_, i) => `Opção ${i + 1}`);
      const result = createPollInputSchema.safeParse({
        title: "Muitas opções",
        options,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("votePollSchema", () => {
    it("valida votação com UUIDs válidos", () => {
      const result = votePollSchema.safeParse({
        optionIds: ["550e8400-e29b-41d4-a716-446655440000"],
      });
      expect(result.success).toBe(true);
    });

    it("rejeita array vazio de opções", () => {
      const result = votePollSchema.safeParse({
        optionIds: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejeita UUID inválido", () => {
      const result = votePollSchema.safeParse({
        optionIds: ["invalid-uuid"],
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("shareInputSchema", () => {
  it("aceita share de perfil com uuid", () => {
    const r = shareInputSchema.safeParse({ kind: "profile", id: "550e8400-e29b-41d4-a716-446655440000" });
    expect(r.success).toBe(true);
  });

  it("exige contentType para library_item", () => {
    const semTipo = shareInputSchema.safeParse({ kind: "library_item", id: "550e8400-e29b-41d4-a716-446655440000" });
    expect(semTipo.success).toBe(false);
    const comTipo = shareInputSchema.safeParse({ kind: "library_item", id: "550e8400-e29b-41d4-a716-446655440000", contentType: "spells" });
    expect(comTipo.success).toBe(true);
  });

  it("rejeita kind inválido e id não-uuid", () => {
    expect(shareInputSchema.safeParse({ kind: "arquivo", id: "550e8400-e29b-41d4-a716-446655440000" }).success).toBe(false);
    expect(shareInputSchema.safeParse({ kind: "post", id: "abc" }).success).toBe(false);
  });
});

describe("createChatMessageSchema com share", () => {
  it("aceita type share com bloco share", () => {
    const r = createChatMessageSchema.safeParse({
      content: "Olha essa magia",
      type: "share",
      share: { kind: "post", id: "550e8400-e29b-41d4-a716-446655440000" },
    });
    expect(r.success).toBe(true);
  });
});

describe("createDmSchema", () => {
  it("aceita uuid e rejeita inválido", () => {
    expect(createDmSchema.safeParse({ userId: "550e8400-e29b-41d4-a716-446655440000" }).success).toBe(true);
    expect(createDmSchema.safeParse({ userId: "x" }).success).toBe(false);
  });
});

describe("updateMemberPermissionsSchema", () => {
  it("aceita flags parciais", () => {
    expect(updateMemberPermissionsSchema.safeParse({ canWrite: false }).success).toBe(true);
  });
  it("rejeita objeto vazio", () => {
    expect(updateMemberPermissionsSchema.safeParse({}).success).toBe(false);
  });
});

describe("removeCampaignMemberSchema", () => {
  it("aceita uuid e rejeita inválido", () => {
    expect(removeCampaignMemberSchema.safeParse({ userId: "550e8400-e29b-41d4-a716-446655440000" }).success).toBe(true);
    expect(removeCampaignMemberSchema.safeParse({ userId: "x" }).success).toBe(false);
  });
});
