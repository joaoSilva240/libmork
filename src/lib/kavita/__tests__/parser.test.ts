import { describe, it, expect } from "vitest";
import { parseOpdsXml } from "../parser";

const SAMPLE_KAVITA_OPDS = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">
  <id>urn:kavita:feed:recently-added</id>
  <title>Recently Added</title>
  <updated>2026-09-21T12:00:00Z</updated>
  <opensearch:totalResults>2</opensearch:totalResults>
  <opensearch:itemsPerPage>10</opensearch:itemsPerPage>
  <opensearch:startIndex>0</opensearch:startIndex>
  <link rel="self" href="/api/opds/abc123key/recently-added" type="application/atom+xml;profile=opds-catalog" />
  <link rel="start" href="/api/opds/abc123key" type="application/atom+xml;profile=opds-catalog" />
  
  <entry>
    <id>urn:kavita:series:101</id>
    <title>Mörk Borg Cult Feretory</title>
    <summary>Um zine de regras e aventuras em um mundo em ruínas.</summary>
    <updated>2026-09-20T10:00:00Z</updated>
    <author>
      <name>Pelle Nilsson</name>
    </author>
    <format xmlns="http://purl.org/dc/terms/format">PDF</format>
    <link rel="http://opds-spec.org/image" href="/api/opds/abc123key/series/101/cover" type="image/jpeg" />
    <link rel="http://opds-spec.org/image/thumbnail" href="/api/opds/abc123key/series/101/thumbnail" type="image/jpeg" />
    <link rel="http://opds-spec.org/acquisition" href="/api/opds/abc123key/series/101/volume/1/chapter/1/download/Feretory.pdf" type="application/pdf" />
  </entry>

  <entry>
    <id>urn:kavita:series:102</id>
    <title>Cy_Borg Asset Pack</title>
    <summary>&lt;p&gt;Suplemento cyberpunk nano-infestado.&lt;/p&gt;</summary>
    <updated>2026-09-21T08:00:00Z</updated>
    <author>
      <name>Christian Sahlén</name>
    </author>
    <link rel="http://opds-spec.org/image" href="/api/opds/abc123key/series/102/cover" type="image/png" />
    <link rel="http://opds-spec.org/acquisition/open-access" href="/api/opds/abc123key/series/102/volume/1/download.pdf" type="application/pdf" />
  </entry>
</feed>`;

describe("Kavita OPDS Parser", () => {
  it("extrai metadados do feed e links raiz", () => {
    const feed = parseOpdsXml(SAMPLE_KAVITA_OPDS, "http://100.122.171.83:5150");

    expect(feed.id).toBe("urn:kavita:feed:recently-added");
    expect(feed.title).toBe("Recently Added");
    expect(feed.totalResults).toBe(2);
    expect(feed.itemsPerPage).toBe(10);
    expect(feed.entries.length).toBe(2);
  });

  it("converte URLs relativas usando o baseUrl configurado", () => {
    const feed = parseOpdsXml(SAMPLE_KAVITA_OPDS, "http://100.122.171.83:5150");
    const entry1 = feed.entries[0];

    expect(entry1.coverUrl).toBe("http://100.122.171.83:5150/api/opds/abc123key/series/101/cover");
    expect(entry1.thumbnailUrl).toBe("http://100.122.171.83:5150/api/opds/abc123key/series/101/thumbnail");
    expect(entry1.acquisitionUrl).toBe("http://100.122.171.83:5150/api/opds/abc123key/series/101/volume/1/chapter/1/download/Feretory.pdf");
  });

  it("extrai títulos, autores, formato e decodifica entidades XML", () => {
    const feed = parseOpdsXml(SAMPLE_KAVITA_OPDS, "http://100.122.171.83:5150");
    const entry2 = feed.entries[1];

    expect(entry2.title).toBe("Cy_Borg Asset Pack");
    expect(entry2.author).toBe("Christian Sahlén");
    expect(entry2.summary).toContain("<p>Suplemento cyberpunk nano-infestado.</p>");
    expect(entry2.acquisitionUrl).toContain("download.pdf");
  });

  it("lida graciosamente com XML inválido ou vazio", () => {
    expect(() => parseOpdsXml("")).toThrow("XML OPDS vazio ou inválido");
  });

  it("reconhece link web reader com incognitoMode=false e não confunde com aquisição PDF", () => {
    const feedWithWebReader = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>urn:kavita:series:56</id>
        <title>Cyberpunk Night City</title>
        <link rel="http://opds-spec.org/image" href="/api/opds/key/series/56/cover" type="image/jpeg" />
        <link rel="alternate" href="/library/4/series/56/pdf/358?incognitoMode=false" type="text/html" />
      </entry>
    </feed>`;

    const feed = parseOpdsXml(feedWithWebReader, "http://100.122.171.83:5150");
    const entry = feed.entries[0];

    expect(entry.webReaderUrl).toBe("http://100.122.171.83:5150/library/4/series/56/pdf/358?incognitoMode=false");
    expect(entry.acquisitionUrl).toBeUndefined();
  });

  it("identifica e agrupa subFeedUrls de volumes e capítulos para expansão de coleções", () => {
    const seriesCollectionXml = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>urn:kavita:series:200</id>
        <title>Mörk Borg Adventures</title>
        <link rel="subsection" href="/api/opds/key/series/200/volume/1" type="application/atom+xml" />
        <link rel="related" href="/api/opds/key/series/200/volume/2" type="application/atom+xml" />
      </entry>
    </feed>`;

    const feed = parseOpdsXml(seriesCollectionXml, "http://100.122.171.83:5150");
    const entry = feed.entries[0];

    expect(entry.subFeedUrls).toBeDefined();
    expect(entry.subFeedUrls).toHaveLength(2);
    expect(entry.subFeedUrls).toContain("http://100.122.171.83:5150/api/opds/key/series/200/volume/1");
    expect(entry.subFeedUrls).toContain("http://100.122.171.83:5150/api/opds/key/series/200/volume/2");
  });
});
