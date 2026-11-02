import { describe, it, expect } from "vitest";
import { extractYouTubeId, getYouTubeThumbnailUrl, formatAudioTime } from "../youtube";

const ID = "dQw4w9WgXcQ";

describe("extractYouTubeId", () => {
  it("extrai de youtube.com/watch?v=ID", () => {
    expect(extractYouTubeId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(extractYouTubeId(`http://www.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(extractYouTubeId(`https://youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it("extrai de subdomínios comuns (m., music.)", () => {
    expect(extractYouTubeId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(extractYouTubeId(`https://music.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it("extrai de watch com query extras (&t=90s, &list=..., &si=...)", () => {
    expect(extractYouTubeId(`https://www.youtube.com/watch?v=${ID}&t=90s`)).toBe(ID);
    expect(extractYouTubeId(`https://www.youtube.com/watch?v=${ID}&list=PL_xxx`)).toBe(ID);
    expect(extractYouTubeId(`https://www.youtube.com/watch?v=${ID}&si=abc12345`)).toBe(ID);
  });

  it("extrai de youtu.be/ID", () => {
    expect(extractYouTubeId(`https://youtu.be/${ID}`)).toBe(ID);
    expect(extractYouTubeId(`http://youtu.be/${ID}`)).toBe(ID);
  });

  it("extrai de youtu.be/ID com query (?t=90s, ?si=...)", () => {
    expect(extractYouTubeId(`https://youtu.be/${ID}?t=90s`)).toBe(ID);
    expect(extractYouTubeId(`https://youtu.be/${ID}?si=abc12345`)).toBe(ID);
  });

  it("extrai de /shorts/ID", () => {
    expect(extractYouTubeId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
    expect(extractYouTubeId(`https://youtube.com/shorts/${ID}`)).toBe(ID);
    expect(extractYouTubeId(`https://www.youtube.com/shorts/${ID}?feature=share`)).toBe(ID);
  });

  it("extrai de /embed/ID", () => {
    expect(extractYouTubeId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
    expect(extractYouTubeId(`https://youtube.com/embed/${ID}`)).toBe(ID);
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
    expect(extractYouTubeId("https://www.youtube.com/playlist?list=PL_9tY0BWXOZ")).toBeNull();
    expect(extractYouTubeId("https://m.youtube.com/playlist?list=PL_9tY0BWXOZ")).toBeNull();
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

describe("getYouTubeThumbnailUrl", () => {
  it("retorna URL hq por padrão", () => {
    expect(getYouTubeThumbnailUrl(ID)).toBe(`https://img.youtube.com/vi/${ID}/hqdefault.jpg`);
  });

  it("retorna URL com qualidade especificada", () => {
    expect(getYouTubeThumbnailUrl(ID, "mq")).toBe(`https://img.youtube.com/vi/${ID}/mqdefault.jpg`);
    expect(getYouTubeThumbnailUrl(ID, "default")).toBe(
      `https://img.youtube.com/vi/${ID}/default.jpg`,
    );
  });
});

describe("formatAudioTime", () => {
  it("formata 0 ou valores negativos como 0:00", () => {
    expect(formatAudioTime(0)).toBe("0:00");
    expect(formatAudioTime(-10)).toBe("0:00");
    expect(formatAudioTime(NaN)).toBe("0:00");
  });

  it("formata minutos e segundos (m:ss)", () => {
    expect(formatAudioTime(5)).toBe("0:05");
    expect(formatAudioTime(65)).toBe("1:05");
    expect(formatAudioTime(125)).toBe("2:05");
    expect(formatAudioTime(599)).toBe("9:59");
  });

  it("formata horas quando maior que 1 hora (h:mm:ss)", () => {
    expect(formatAudioTime(3600)).toBe("1:00:00");
    expect(formatAudioTime(3665)).toBe("1:01:05");
  });
});
