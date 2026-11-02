// =============================================================================
// Libmork — Audio: Testes de extração de ID do YouTube (Issue #60)
// =============================================================================

import { describe, it, expect } from "vitest";
import { extractYouTubeId } from "../youtube";

const ID = "dQw4w9WgXcQ";

describe("extractYouTubeId", () => {
  it("extrai ID de watch?v= com www (https)", () => {
    expect(extractYouTubeId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it("extrai ID de watch?v= sem www", () => {
    expect(extractYouTubeId(`https://youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it("extrai ID de youtu.be", () => {
    expect(extractYouTubeId(`https://youtu.be/${ID}`)).toBe(ID);
  });

  it("extrai ID de /shorts/", () => {
    expect(extractYouTubeId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
  });

  it("extrai ID de /embed/", () => {
    expect(extractYouTubeId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
  });

  it("aceita variante http://", () => {
    expect(extractYouTubeId(`http://youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(extractYouTubeId(`http://youtu.be/${ID}`)).toBe(ID);
  });

  it("aceita query extras após o ID (&t=90s, &list=...)", () => {
    expect(extractYouTubeId(`https://www.youtube.com/watch?v=${ID}&t=90s`)).toBe(ID);
    expect(extractYouTubeId(`https://www.youtube.com/watch?v=${ID}&t=90s&list=PL_abc123`)).toBe(ID);
  });

  it("valor de v= prevalece mesmo com list= junto", () => {
    expect(
      extractYouTubeId(`https://www.youtube.com/watch?list=PL_other&v=${ID}`)
    ).toBe(ID);
  });

  it("aceita si= em youtu.be e query em shorts", () => {
    expect(extractYouTubeId(`https://youtu.be/${ID}?si=abc_def-123`)).toBe(ID);
    expect(extractYouTubeId(`https://www.youtube.com/shorts/${ID}?t=10`)).toBe(ID);
  });

  it("aceita m.youtube.com watch?v=", () => {
    expect(extractYouTubeId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it("sanitiza: retorna apenas os 11 caracteres do match", () => {
    expect(extractYouTubeId(`https://www.youtube.com/watch?v=${ID}&t=90s`)).toBe(ID);
    expect(extractYouTubeId(`https://www.youtube.com/shorts/${ID}&t=1`)).toBe(ID);
  });

  it("rejeita string vazia e espaços", () => {
    expect(extractYouTubeId("")).toBeNull();
    expect(extractYouTubeId("   ")).toBeNull();
  });

  it("rejeita texto aleatório sem URL válida", () => {
    expect(extractYouTubeId("texto aleatório")).toBeNull();
    expect(extractYouTubeId("dQw4w9WgXcQ")).toBeNull();
  });

  it("rejeita URLs de outras plataformas", () => {
    expect(extractYouTubeId("https://vimeo.com/76979871")).toBeNull();
    expect(extractYouTubeId(`https://meusite.com/watch?v=${ID}`)).toBeNull();
  });

  it("rejeita /playlist?list= sem v= em www e m", () => {
    expect(
      extractYouTubeId("https://www.youtube.com/playlist?list=PL_9tY0BWXOZ")
    ).toBeNull();
    expect(
      extractYouTubeId("https://m.youtube.com/playlist?list=PL_9tY0BWXOZ")
    ).toBeNull();
  });

  it("rejeita /watch sem v=", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch")).toBeNull();
    expect(extractYouTubeId("https://www.youtube.com/watch?t=90s")).toBeNull();
  });

  it("rejeita ID com 10 ou 12 caracteres", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=shortid921")).toBeNull();
    expect(extractYouTubeId("https://youtu.be/abcdefghij")).toBeNull();
    expect(extractYouTubeId("https://youtu.be/abcdefghijkl")).toBeNull();
    expect(extractYouTubeId("https://www.youtube.com/shorts/abcdefghijkl")).toBeNull();
  });
});
