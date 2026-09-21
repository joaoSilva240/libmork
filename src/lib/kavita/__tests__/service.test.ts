import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateKavitaTargetUrl, getKavitaConfig, safeFetchKavita } from "../config";
import { getKavitaCatalog } from "../service";

describe("Kavita Config & SSRF Protection", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("bloqueia URLs com protocolos perigosos como file://, ftp:// ou gopher://", () => {
    expect(validateKavitaTargetUrl("file:///etc/passwd").valid).toBe(false);
    expect(validateKavitaTargetUrl("gopher://127.0.0.1:5150").valid).toBe(false);
  });

  it("bloqueia endpoints de metadados de nuvem e AWS", () => {
    expect(validateKavitaTargetUrl("http://169.254.169.254/latest/meta-data/").valid).toBe(false);
    expect(validateKavitaTargetUrl("http://metadata.google.internal/computeMetadata/v1/").valid).toBe(false);
    expect(validateKavitaTargetUrl("http://100.100.100.100/").valid).toBe(false);
  });

  it("permite o endpoint configurado padrão do Kavita (100.122.171.83:5150)", () => {
    const res = validateKavitaTargetUrl("http://100.122.171.83:5150/api/opds/test-key");
    expect(res.valid).toBe(true);
    expect(res.url?.hostname).toBe("100.122.171.83");
  });

  it("normaliza KAVITA_URL sem protocolo ou com trailing slashes", () => {
    process.env.KAVITA_URL = "100.122.171.83:5150///";
    const config = getKavitaConfig();
    expect(config.baseUrl).toBe("http://100.122.171.83:5150");
  });

  it("corrige URL malformada como http:100.122.171.83:5150 para formato seguro com barras", () => {
    process.env.KAVITA_URL = "http:100.122.171.83:5150";
    const config = getKavitaConfig();
    expect(config.baseUrl).toBe("http://100.122.171.83:5150");

    const validCheck = validateKavitaTargetUrl("http:100.122.171.83:5150/api/opds/test");
    expect(validCheck.valid).toBe(true);
    expect(validCheck.url?.toString()).toBe("http://100.122.171.83:5150/api/opds/test");
  });

  it("bloqueia URLs externas ou com portas divergentes do Kavita configurado", () => {
    process.env.KAVITA_URL = "http://100.122.171.83:5150";
    expect(validateKavitaTargetUrl("http://100.122.171.83:8080/api/opds/test").valid).toBe(false);
    expect(validateKavitaTargetUrl("http://evil.com/api/opds/test").valid).toBe(false);
  });

  it("retorna isConfigured=false quando KAVITA_OPDS_KEY está ausente", () => {
    delete process.env.KAVITA_OPDS_KEY;
    const config = getKavitaConfig();
    expect(config.isConfigured).toBe(false);
  });

  it("retorna isConfigured=true quando KAVITA_OPDS_KEY é informada", () => {
    process.env.KAVITA_OPDS_KEY = "test-secret-key-12345";
    const config = getKavitaConfig();
    expect(config.isConfigured).toBe(true);
    expect(config.apiKey).toBe("test-secret-key-12345");
  });
});

describe("Kavita Catalog Service", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("retorna configured=false quando não há KAVITA_OPDS_KEY", async () => {
    delete process.env.KAVITA_OPDS_KEY;
    const res = await getKavitaCatalog();
    expect(res.configured).toBe(false);
    expect(res.items).toEqual([]);
    expect(res.error).toContain("KAVITA_OPDS_KEY não configurada");
  });

  it("converte itens do XML para itens de catálogo com proxy seguro do Libmork", async () => {
    process.env.KAVITA_OPDS_KEY = "dummy-key-abc";
    process.env.KAVITA_URL = "http://100.122.171.83:5150";

    const mockXml = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>urn:1</id>
        <title>Mörk Borg Rulebook</title>
        <summary>Apocalyptic RPG</summary>
        <link rel="http://opds-spec.org/image" href="/api/opds/dummy-key-abc/series/1/cover" />
        <link rel="http://opds-spec.org/acquisition" href="/api/opds/dummy-key-abc/series/1/volume/1/download.pdf" type="application/pdf" />
      </entry>
    </feed>`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => mockXml,
      headers: new Headers(),
    } as any);

    const res = await getKavitaCatalog();
    expect(res.configured).toBe(true);
    expect(res.items.length).toBe(1);

    const item = res.items[0];
    expect(item.title).toBe("Mörk Borg Rulebook");
    expect(item.hasPdf).toBe(true);
    // Verifica se os links foram roteados para o proxy seguro sem expor credenciais
    expect(item.pdfProxyUrl).toContain("/api/library/kavita/proxy?url=");
    expect(item.coverProxyUrl).toContain("/api/library/kavita/proxy?url=");
  });

  it("percorre todas as páginas com paginação OPDS completa (rel='next')", async () => {
    process.env.KAVITA_OPDS_KEY = "dummy-key-abc";
    process.env.KAVITA_URL = "http://100.122.171.83:5150";

    const page1Xml = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <link rel="next" href="/api/opds/dummy-key-abc/recently-added?page=2" />
      <entry>
        <id>urn:1</id>
        <title>Livro Página 1</title>
        <link rel="http://opds-spec.org/acquisition" href="/api/opds/dummy-key-abc/1.pdf" type="application/pdf" />
      </entry>
    </feed>`;

    const page2Xml = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>urn:2</id>
        <title>Livro Página 2</title>
        <link rel="http://opds-spec.org/acquisition" href="/api/opds/dummy-key-abc/2.pdf" type="application/pdf" />
      </entry>
    </feed>`;

    global.fetch = vi.fn().mockImplementation((url: string) => {
      const isPage2 = url.includes("page=2");
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => (isPage2 ? page2Xml : page1Xml),
        headers: new Headers(),
      } as any);
    });

    const res = await getKavitaCatalog();
    expect(res.configured).toBe(true);
    expect(res.items.length).toBe(2);
    expect(res.items[0].title).toBe("Livro Página 1");
    expect(res.items[1].title).toBe("Livro Página 2");
  });

  it("segue volumeUrl server-side quando entry raiz só possui leitor web ou sub-feed sem download", async () => {
    process.env.KAVITA_OPDS_KEY = "dummy-key-abc";
    process.env.KAVITA_URL = "http://100.122.171.83:5150";

    const seriesXml = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>urn:series:56</id>
        <title>Mörk Borg Manual</title>
        <link rel="alternate" href="/library/4/series/56/pdf/358?incognitoMode=false" type="text/html" />
        <link rel="subsection" href="/api/opds/dummy-key-abc/series/56/volume/1" type="application/atom+xml" />
      </entry>
    </feed>`;

    const volumeXml = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>urn:volume:1</id>
        <title>Volume 1 PDF</title>
        <link rel="http://opds-spec.org/acquisition" href="/api/opds/dummy-key-abc/volume/1/download.pdf" type="application/pdf" />
      </entry>
    </feed>`;

    global.fetch = vi.fn().mockImplementation((url: string) => {
      const isVolume = url.includes("/volume/1");
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => (isVolume ? volumeXml : seriesXml),
        headers: new Headers(),
      } as any);
    });

    const res = await getKavitaCatalog();
    expect(res.configured).toBe(true);
    expect(res.items.length).toBe(1);
    expect(res.items[0].hasPdf).toBe(true);
    expect(res.items[0].acquisitionUrl).toContain("download.pdf");
    expect(res.items[0].webReaderUrl).toContain("incognitoMode=false");
  });

  it("não define hasPdf nem pdfProxyUrl quando entry possui apenas webReaderUrl e sem download PDF", async () => {
    process.env.KAVITA_OPDS_KEY = "dummy-key-abc";
    process.env.KAVITA_URL = "http://100.122.171.83:5150";

    const webOnlyXml = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>urn:series:99</id>
        <title>Apenas Web</title>
        <link rel="alternate" href="/library/4/series/99/pdf/123?incognitoMode=false" type="text/html" />
      </entry>
    </feed>`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => webOnlyXml,
      headers: new Headers(),
    } as any);

    const res = await getKavitaCatalog();
    expect(res.configured).toBe(true);
    expect(res.items.length).toBe(1);
    expect(res.items[0].hasPdf).toBe(false);
    expect(res.items[0].pdfProxyUrl).toBeUndefined();
    expect(res.items[0].webReaderUrl).toBe("http://100.122.171.83:5150/library/4/series/99/pdf/123?incognitoMode=false");
  });

  it("expande coleção com múltiplos volumes/PDFs gerando itens individuais", async () => {
    process.env.KAVITA_OPDS_KEY = "dummy-key-abc";
    process.env.KAVITA_URL = "http://100.122.171.83:5150";

    const seriesFeedXml = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>urn:series:300</id>
        <title>Mörk Borg Suplementos</title>
        <author><name>Stockholm Kartell</name></author>
        <summary>Coleção oficial de zines e aventuras</summary>
        <link rel="http://opds-spec.org/image" href="/api/opds/dummy-key-abc/series/300/cover" />
        <link rel="subsection" href="/api/opds/dummy-key-abc/series/300/volumes" type="application/atom+xml" />
      </entry>
    </feed>`;

    const volumesFeedXml = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>urn:volume:1</id>
        <title>Volume 1 - Feretory</title>
        <summary>Zine 1</summary>
        <link rel="http://opds-spec.org/image" href="/api/opds/dummy-key-abc/volume/1/cover" />
        <link rel="http://opds-spec.org/acquisition" href="/api/opds/dummy-key-abc/volume/1/feretory.pdf" type="application/pdf" />
      </entry>
      <entry>
        <id>urn:volume:2</id>
        <title>Volume 2 - Heretic</title>
        <link rel="http://opds-spec.org/acquisition" href="/api/opds/dummy-key-abc/volume/2/heretic.pdf" type="application/pdf" />
      </entry>
    </feed>`;

    global.fetch = vi.fn().mockImplementation((url: string) => {
      const isVolumesFeed = url.includes("/series/300/volumes");
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => (isVolumesFeed ? volumesFeedXml : seriesFeedXml),
        headers: new Headers(),
      } as any);
    });

    const res = await getKavitaCatalog();
    expect(res.configured).toBe(true);
    expect(res.items.length).toBe(2);

    const item1 = res.items[0];
    const item2 = res.items[1];

    // Item 1: título combinado ou herdado legivelmente
    expect(item1.id).toBe("urn:series:300-urn:volume:1");
    expect(item1.title).toBe("Mörk Borg Suplementos - Volume 1 - Feretory");
    expect(item1.hasPdf).toBe(true);
    expect(item1.acquisitionUrl).toContain("feretory.pdf");
    expect(item1.coverProxyUrl).toContain("volume%2F1%2Fcover");
    expect(item1.author).toBe("Stockholm Kartell");

    // Item 2: herda capa da série pai quando não tiver capa própria
    expect(item2.id).toBe("urn:series:300-urn:volume:2");
    expect(item2.title).toBe("Mörk Borg Suplementos - Volume 2 - Heretic");
    expect(item2.hasPdf).toBe(true);
    expect(item2.acquisitionUrl).toContain("heretic.pdf");
    expect(item2.coverProxyUrl).toContain("series%2F300%2Fcover");
    expect(item2.summary).toBe("Coleção oficial de zines e aventuras");
  });

  it("deduplica itens quando múltiplos sub-feeds ou links referenciam o mesmo ID ou acquisitionUrl", async () => {
    process.env.KAVITA_OPDS_KEY = "dummy-key-abc";
    process.env.KAVITA_URL = "http://100.122.171.83:5150";

    const seriesFeedXml = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>urn:series:57</id>
        <title>Mörk Borg Livro Base</title>
        <link rel="subsection" href="/api/opds/dummy-key-abc/series/57/volumes" type="application/atom+xml" />
        <link rel="alternate" href="/api/opds/dummy-key-abc/series/57/chapters" type="application/atom+xml" />
      </entry>
    </feed>`;

    // Tanto /volumes quanto /chapters retornam o mesmo volume 373 com o mesmo PDF
    const subFeedXml = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>373</id>
        <title>Capítulo 1</title>
        <link rel="http://opds-spec.org/acquisition" href="/api/opds/dummy-key-abc/download/373.pdf" type="application/pdf" />
      </entry>
    </feed>`;

    global.fetch = vi.fn().mockImplementation((url: string) => {
      const isSubFeed = url.includes("/series/57/volumes") || url.includes("/series/57/chapters");
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => (isSubFeed ? subFeedXml : seriesFeedXml),
        headers: new Headers(),
      } as any);
    });

    const res = await getKavitaCatalog();
    expect(res.configured).toBe(true);
    // Deve conter apenas 1 item após a deduplicação rigorosa
    expect(res.items.length).toBe(1);
    expect(res.items[0].id).toBe("urn:series:57-373");
    expect(res.items[0].acquisitionUrl).toContain("373.pdf");
  });
});
