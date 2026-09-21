import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { LibraryDocuments } from "@/components/library/LibraryDocuments";
import { resolvePdfEmbedUrl, PdfViewerModal } from "@/components/library/PdfViewerModal";
import { CreateDocumentModal } from "@/components/library/CreateDocumentModal";
import { TomeViewer, TOME_DEFAULT_URL } from "@/components/library/TomeViewer";

describe("PdfViewerModal & resolvePdfEmbedUrl", () => {
  it("converte SMB URL para endpoint de stream seguro", () => {
    const smbDoc = {
      externalUrl: "livros/dnd-5e.pdf",
      provider: "smb",
    };
    const { embedUrl } = resolvePdfEmbedUrl(smbDoc);
    expect(embedUrl).toBe(
      "/api/library/documents/stream?file=livros%2Fdnd-5e.pdf"
    );
  });

  it("converte SMB URL com protocolo smb:// para endpoint de stream", () => {
    const smbDoc = {
      externalUrl: "smb://storage/livros/dnd-5e.pdf",
      provider: "smb",
    };
    const { embedUrl } = resolvePdfEmbedUrl(smbDoc);
    expect(embedUrl).toBe(
      "/api/library/documents/stream?file=smb%3A%2F%2Fstorage%2Flivros%2Fdnd-5e.pdf"
    );
  });

  it("converte link do Google Drive para /preview", () => {
    const gdriveDoc = {
      externalUrl: "https://drive.google.com/file/d/123456789abc/view?usp=sharing",
      provider: "gdrive",
    };
    const { embedUrl } = resolvePdfEmbedUrl(gdriveDoc);
    expect(embedUrl).toBe(
      "https://drive.google.com/file/d/123456789abc/preview"
    );
  });

  it("converte link do Google Drive com parâmetro id= para /preview", () => {
    const gdriveDoc = {
      externalUrl: "https://drive.google.com/open?id=123456789abc",
      provider: "gdrive",
    };
    const { embedUrl } = resolvePdfEmbedUrl(gdriveDoc);
    expect(embedUrl).toBe(
      "https://drive.google.com/file/d/123456789abc/preview"
    );
  });

  it("renderiza o modal de visualização e fallback 'Abrir original'", () => {
    const onClose = vi.fn();
    render(
      <PdfViewerModal
        isOpen={true}
        onClose={onClose}
        title="Livro de Regras"
        url="https://drive.google.com/file/d/123/view"
        provider="gdrive"
        externalUrl="https://drive.google.com/file/d/123/view"
      />
    );

    expect(screen.getByText("Livro de Regras")).toBeInTheDocument();
    expect(screen.getByTitle("Abrir arquivo em nova aba")).toBeInTheDocument();
    const iframe = screen.getByTitle("Livro de Regras");
    expect(iframe).toHaveAttribute(
      "src",
      "https://drive.google.com/file/d/123/preview"
    );

    fireEvent.click(screen.getByLabelText("Fechar visualizador"));
    expect(onClose).toHaveBeenCalled();
  });

  it("resolvePdfEmbedUrl retorna null e nunca string vazia quando não há URLs candidatas", () => {
    const res1 = resolvePdfEmbedUrl({});
    expect(res1.embedUrl).toBeNull();
    expect(res1.isDirectEmbedPossible).toBe(false);

    const res2 = resolvePdfEmbedUrl({
      externalUrl: "",
      url: "   ",
      pdfProxyUrl: null,
      acquisitionUrl: undefined,
    });
    expect(res2.embedUrl).toBeNull();
    expect(res2.isDirectEmbedPossible).toBe(false);
  });

  it("resolvePdfEmbedUrl prioriza pdfProxyUrl e acquisitionUrl", () => {
    const docWithProxy = {
      pdfProxyUrl: "/api/library/kavita/proxy?url=test&type=pdf",
      acquisitionUrl: "http://kavita/acq.pdf",
      externalUrl: "https://external.com/doc.pdf",
      url: "https://url.com/doc.pdf",
      provider: "kavita",
    };
    const resProxy = resolvePdfEmbedUrl(docWithProxy);
    expect(resProxy.embedUrl).toBe("/api/library/kavita/proxy?url=test&type=pdf");

    const docWithAcq = {
      acquisitionUrl: "http://kavita/acq.pdf",
      externalUrl: "https://external.com/doc.pdf",
      provider: "kavita",
    };
    const resAcq = resolvePdfEmbedUrl(docWithAcq);
    expect(resAcq.embedUrl).toBe(
      `/api/library/kavita/proxy?url=${encodeURIComponent("http://kavita/acq.pdf")}&type=pdf`
    );
  });

  it("não renderiza iframe para leitor web Kavita com incognitoMode e oferece 'Abrir no Kavita'", () => {
    const webReaderDoc = {
      title: "Livro Web Kavita",
      provider: "kavita",
      url: "http://100.122.171.83:5150/library/4/series/56/pdf/358?incognitoMode=false",
      externalUrl: "",
      pdfProxyUrl: null,
      acquisitionUrl: null,
      webReaderUrl: "http://100.122.171.83:5150/library/4/series/56/pdf/358?incognitoMode=false",
    };

    const resEmbed = resolvePdfEmbedUrl(webReaderDoc);
    expect(resEmbed.embedUrl).toBeNull();
    expect(resEmbed.isDirectEmbedPossible).toBe(false);

    render(
      <PdfViewerModal
        isOpen={true}
        onClose={vi.fn()}
        title={webReaderDoc.title}
        provider={webReaderDoc.provider}
        externalUrl={webReaderDoc.externalUrl}
        pdfProxyUrl={webReaderDoc.pdfProxyUrl}
        acquisitionUrl={webReaderDoc.acquisitionUrl}
        webReaderUrl={webReaderDoc.webReaderUrl}
      />
    );

    // Não deve existir iframe no DOM
    expect(screen.queryByTitle("Livro Web Kavita")).toBeNull();
    // Deve renderizar o botão/link "Abrir no Kavita"
    expect(screen.getAllByText("Abrir no Kavita").length).toBeGreaterThan(0);
  });

  it("não renderiza iframe src='' quando não há URLs e exibe mensagem amigável sem link original vazio", () => {
    const { container } = render(
      <PdfViewerModal
        isOpen={true}
        onClose={vi.fn()}
        title="Documento Sem URL"
        provider="external"
      />
    );

    // Iframe não deve existir ou não deve ter src vazio
    const iframe = container.querySelector("iframe");
    expect(iframe).toBeNull();

    // Mensagem amigável de erro visível
    expect(screen.getByText("Não foi possível carregar o documento")).toBeInTheDocument();

    // Não deve renderizar botão/link de 'Abrir original'
    expect(screen.queryByTitle("Abrir arquivo em nova aba")).toBeNull();
    expect(screen.queryByText("Abrir original")).toBeNull();
  });
});

describe("CreateDocumentModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permite preencher e submeter novo documento", async () => {
    const mockSuccess = vi.fn();
    const mockClose = vi.fn();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: "new-doc-1",
          title: "Novo Livro",
          externalUrl: "https://exemplo.com/regras.pdf",
          provider: "external",
          category: "livro-base",
          isOfficial: false,
          isPublic: true,
        },
      }),
    } as any);

    render(
      <CreateDocumentModal
        isOpen={true}
        onClose={mockClose}
        onSuccess={mockSuccess}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Ex: Tormenta20/i), {
      target: { value: "Novo Livro" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Ex: https:\/\/meusite\.com\/documento\.pdf/i), {
      target: { value: "https://exemplo.com/regras.pdf" },
    });

    fireEvent.click(screen.getByText("Adicionar Referência"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/library/documents",
        expect.objectContaining({
          method: "POST",
        })
      );
      expect(mockSuccess).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
    });
  });
});

describe("LibraryDocuments Component", () => {
  const mockDocs = [
    {
      id: "doc-official-1",
      title: "Manual Oficial Libmork",
      description: "Regras principais",
      coverUrl: null,
      externalUrl: "https://libmork.com/rules.pdf",
      provider: "external",
      category: "livro-base",
      tags: ["oficial", "core"],
      isOfficial: true,
      isPublic: true,
      campaignId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "doc-smb-2",
      title: "Suplemento de Monstros",
      description: "Monstros da rede SMB",
      coverUrl: null,
      externalUrl: "monstros/tabela.pdf",
      provider: "smb",
      category: "suplemento",
      tags: ["monstros"],
      isOfficial: false,
      isPublic: true,
      campaignId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { id: "user-1", email: "mestre@teste.com" },
          }),
        });
      }
      if (url.includes("/api/library/documents")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: mockDocs,
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    }) as any;
  });

  it("renderiza lista de documentos com badges e ações", async () => {
    render(<LibraryDocuments />);

    await waitFor(() => {
      expect(screen.getByText("Manual Oficial Libmork")).toBeInTheDocument();
      expect(screen.getByText("Suplemento de Monstros")).toBeInTheDocument();
    });

    // Badge de oficial
    expect(screen.getByText("OFICIAL")).toBeInTheDocument();

    // Provedores
    expect(screen.getByText("external")).toBeInTheDocument();
    expect(screen.getByText("smb")).toBeInTheDocument();

    // Documento oficial NÃO deve ter botão de exclusão
    // Apenas documento não-oficial deve ter botão excluir/editar
    const deleteButtons = screen.getAllByLabelText("Excluir");
    expect(deleteButtons.length).toBe(1);

    const editButtons = screen.getAllByLabelText("Editar");
    expect(editButtons.length).toBe(1);
  });

  it("renderiza o botão 'Tome' e alterna para o visualizador Tome inline (sem dialog/modal)", async () => {
    render(<LibraryDocuments />);

    await waitFor(() => {
      expect(screen.getByText("Tome")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Buscar regras, livros, manuais...")).toBeInTheDocument();
    });

    const tomeButton = screen.getByRole("button", { name: /Tome/i });
    fireEvent.click(tomeButton);

    await waitFor(() => {
      // Confirma que não é modal / dialog
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Tome" })).toBeInTheDocument();

      // Painel inline substitui a barra de busca e lista
      expect(screen.queryByPlaceholderText("Buscar regras, livros, manuais...")).not.toBeInTheDocument();
      expect(screen.queryByText("Manual Oficial Libmork")).not.toBeInTheDocument();

      // Iframe inline carregado com o URL esperado e dimensões de desktop
      const iframe = screen.getByTitle("Visualizador Tome");
      expect(iframe).toHaveAttribute("src", TOME_DEFAULT_URL);
      expect(iframe).toHaveStyle({ width: "100%", height: "100%" });
      expect(iframe).not.toHaveAttribute("scrolling");

      // No modo desktop (escudo do mestre), não há clip wrapper artificial de mobile
      expect(screen.queryByTestId("tome-clip-wrapper")).not.toBeInTheDocument();
    });

    // Clica no botão de fechar/voltar
    fireEvent.click(screen.getByRole("button", { name: "Voltar / Fechar Tome" }));

    await waitFor(() => {
      // Ao voltar, painel Tome fecha e restaura a lista e os filtros de busca
      expect(screen.queryByRole("heading", { name: "Tome" })).not.toBeInTheDocument();
      expect(screen.queryByTitle("Visualizador Tome")).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText("Buscar regras, livros, manuais...")).toBeInTheDocument();
      expect(screen.getByText("Manual Oficial Libmork")).toBeInTheDocument();
    });
  });

  it("abre o PdfViewerModal ao clicar em 'Visualizar'", async () => {
    render(<LibraryDocuments />);

    await waitFor(() => {
      expect(screen.getByText("Suplemento de Monstros")).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByText("Visualizar");
    fireEvent.click(viewButtons[1]); // clica no doc SMB

    await waitFor(() => {
      const modalHeader = screen.getByRole("heading", { level: 2 });
      expect(modalHeader).toHaveTextContent("Suplemento de Monstros");
    });
  });

  it("renderiza um poster Kavita, abre o modal e confirma iframe src com proxy e url codificado", async () => {
    const kavitaDocItem = {
      id: "kavita-101",
      title: "Mörk Borg Cult Feretory",
      description: "Zine de regras apocalípticas",
      coverUrl: "/api/library/kavita/proxy?url=http%3A%2F%2F100.122.171.83%3A5150%2Fcover.jpg&type=image",
      externalUrl: "/api/library/kavita/proxy?url=http%3A%2F%2F100.122.171.83%3A5150%2Fapi%2Fopds%2Fkey%2Fdownload.pdf&type=pdf",
      pdfProxyUrl: "/api/library/kavita/proxy?url=http%3A%2F%2F100.122.171.83%3A5150%2Fapi%2Fopds%2Fkey%2Fdownload.pdf&type=pdf",
      acquisitionUrl: "http://100.122.171.83:5150/api/opds/key/download.pdf",
      provider: "kavita",
      category: "livro-base",
      tags: ["kavita", "opds"],
      isOfficial: false,
      isPublic: true,
      campaignId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { id: "user-1", email: "mestre@teste.com" },
          }),
        });
      }
      if (url.includes("/api/library/documents")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [kavitaDocItem],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    }) as any;

    render(<LibraryDocuments />);

    await waitFor(() => {
      expect(screen.getByText("Mörk Borg Cult Feretory")).toBeInTheDocument();
    });

    const viewButton = screen.getByText("Visualizar");
    fireEvent.click(viewButton);

    await waitFor(() => {
      const modalHeader = screen.getByRole("heading", { level: 2 });
      expect(modalHeader).toHaveTextContent("Mörk Borg Cult Feretory");
    });

    const iframe = screen.getByTitle("Mörk Borg Cult Feretory");
    const src = iframe.getAttribute("src") || "";
    expect(src).toContain("/api/library/kavita/proxy");
    expect(src).toContain("url=");
    expect(src).toContain(encodeURIComponent("http://100.122.171.83:5150/api/opds/key/download.pdf"));
  });

  it("renderiza poster Kavita mesmo quando externalUrl vem apenas com link bruto de aquisição e monta proxy com url codificado", async () => {
    const rawKavitaDoc = {
      id: "kavita-102",
      title: "Cy_Borg Rulebook",
      description: "Livro básico de Cy_Borg",
      coverUrl: null,
      externalUrl: "http://100.122.171.83:5150/api/opds/key/cyborg.pdf",
      provider: "kavita",
      category: "livro-base",
      tags: ["kavita"],
      isOfficial: false,
      isPublic: true,
      campaignId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { id: "user-1", email: "mestre@teste.com" },
          }),
        });
      }
      if (url.includes("/api/library/documents")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [rawKavitaDoc],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    }) as any;

    render(<LibraryDocuments />);

    await waitFor(() => {
      expect(screen.getByText("Cy_Borg Rulebook")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Visualizar"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Cy_Borg Rulebook");
    });

    const iframe = screen.getByTitle("Cy_Borg Rulebook");
    const src = iframe.getAttribute("src") || "";
    expect(src).toBe(
      `/api/library/kavita/proxy?url=${encodeURIComponent("http://100.122.171.83:5150/api/opds/key/cyborg.pdf")}&type=pdf`
    );
  });

  it("resolve PdfEmbedUrl apropriado para livros vindos do provedor kavita", () => {
    const kavitaDoc = {
      externalUrl: "/api/library/kavita/proxy?url=http%3A%2F%2F100.122.171.83%3A5150%2Fapi%2Fopds%2Fdownload.pdf&type=pdf",
      provider: "kavita",
    };
    const { embedUrl, isDirectEmbedPossible } = resolvePdfEmbedUrl(kavitaDoc);
    expect(isDirectEmbedPossible).toBe(true);
    expect(embedUrl).toBe(kavitaDoc.externalUrl);
  });

  it("garante que PdfEmbedUrl para Kavita com URL remota aponte para o proxy same-origin", () => {
    const kavitaRemoteDoc = {
      externalUrl: "http://100.122.171.83:5150/api/opds/key/download.pdf",
      provider: "kavita",
    };
    const { embedUrl, isDirectEmbedPossible } = resolvePdfEmbedUrl(kavitaRemoteDoc);
    expect(isDirectEmbedPossible).toBe(true);
    expect(embedUrl).toBe(
      `/api/library/kavita/proxy?url=${encodeURIComponent(kavitaRemoteDoc.externalUrl)}&type=pdf`
    );
  });
});
