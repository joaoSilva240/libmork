"use client";

import { useEffect, useState, useRef } from "react";
import "leaflet/dist/leaflet.css";
import "@/styles/leaflet.css";
import type { MapPin } from "@/types";
import { Spinner } from "@/components/ui";
import { generateUUID } from "@/lib/utils/uuid";

type MapEditorProps = {
  worldId: string;
  mapUrl?: string | null;
  onSave?: (pins: MapPin[]) => Promise<void>;
  isMissing?: boolean;
};

export function MapEditor({ worldId, mapUrl, onSave, isMissing = false }: MapEditorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Carregar pins do servidor
  useEffect(() => {
    const loadPins = async () => {
      try {
        const response = await fetch(`/api/worlds/${worldId}/pins`, {
          credentials: "include",
        });
        const data = await response.json();
        if (response.ok && data.data) {
          setPins(data.data);
        }
      } catch (err) {
        console.error("Erro ao carregar pins:", err);
        setError("Erro ao carregar pins do mapa");
      } finally {
        setLoading(false);
      }
    };
    loadPins();
  }, [worldId]);

  // Estado para rastrear o modo do mapa (custom vs tile layer)
  const [mapMode, setMapMode] = useState<"custom" | "global">("global");

  // Inicializar Leaflet quando o container estiver disponível
  useEffect(() => {
    if (!mapContainerRef.current || loading) return;

    // Importar Leaflet dinamicamente (client-side only)
    const loadLeaflet = async () => {
      try {
        const L = await import("leaflet");
        window.L = L;

        // Configurar ícones de marker
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
        });

        // Criar mapa com estilo RPG/escuro
        // Configurações de zoom suave e navegação
        const minZoomLevel = 1;
        const maxZoomLevel = 18;

        const map = window.L.map(mapContainerRef.current! as HTMLElement, {
          zoomControl: true,
          attributionControl: true,
          worldCopyJump: true,
          inertia: true,
          inertiaDeceleration: 3000,
          minZoom: minZoomLevel,
          maxZoom: maxZoomLevel,
        }).setView([-15.7801, -47.9292], 4); // Brasil por padrão

        // Ativar animação de bounce após criação do mapa
        (map.options as any).bounceAnimation = true;

        // Adicionar tile layer padrão (será removido se usar mapUrl)
        const tileLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        }).addTo(map);

        // Função para carregar imagem customizada
        const loadCustomMap = () => {
          if (!mapUrl || typeof mapUrl !== "string" || !mapUrl.trim()) {
            setMapMode("global");
            return true;
          }

          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.src = mapUrl;

          img.onload = () => {
            // Remover tile layer
            map.removeLayer(tileLayer);

            // Usar bounds padrão do mundo (latitude e longitude completas)
            // Southwest: [-90, -180], Northeast: [90, 180]
            const bounds = L.latLngBounds([
              [-90, -180],
              [90, 180],
            ]);

            // Criar image overlay
            const imageOverlay = L.imageOverlay(mapUrl, bounds, {
              opacity: 0.9,
              interactive: true,
            }).addTo(map);

            // Ajustar zoom e visualização para a imagem
            const ImageBounds = imageOverlay.getBounds();
            map.fitBounds(ImageBounds, { padding: [50, 50] });

            // Calcular maxZoom baseado nas dimensões da imagem
            // Para imagem cubrir o mundo inteiro, maxZoom = log2(imageWidth / 256)
            // Onde 256 é a largura padrão do tile no zoom 0
            const imageWidth = img.width;
            const calculatedMaxZoom = Math.floor(Math.log2(imageWidth / 256)) + 1;

            // Ajustar os limites de zoom do mapa
            // Usar o mínimo entre o calculado e 20 para evitar valores excessivos
            const finalMaxZoom = Math.min(calculatedMaxZoom, 20);
            map.options.minZoom = minZoomLevel;
            map.options.maxZoom = finalMaxZoom;

            setMapMode("custom");
          };

          img.onerror = () => {
            console.warn("Falha ao carregar mapa customizado, usando tile layer padrão");
            setMapMode("global");
          };

          return true;
        };

        // Tentar carregar mapa customizado se mapUrl estiver definido
        if (mapUrl && mapUrl.trim()) {
          loadCustomMap();
        } else {
          setMapMode("global");
        }

        mapInstanceRef.current = map;

        // Adicionar evento de clique direito (context menu) para adicionar pins
        map.on("contextmenu", (e: any) => {
          addPin(e.latlng.lat, e.latlng.lng);
        });

        // Ajustar mapa se houver pins
        if (pins.length > 0) {
          const latLngs = pins.map((p) => [p.lat, p.lng] as [number, number]);
          const bounds = window.L.latLngBounds(latLngs);
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (err) {
        console.error("Erro ao carregar Leaflet:", err);
        setError("Erro ao carregar mapa interativo");
      }
    };

    loadLeaflet();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [loading, mapUrl]);

  // Atualizar pins quando a lista mudar
  useEffect(() => {
    if (mapInstanceRef.current && !loading) {
      // Limpar markers existentes
      mapInstanceRef.current.eachLayer((layer: any) => {
        if (layer instanceof window.L.Marker) {
          mapInstanceRef.current.removeLayer(layer);
        }
      });

      // Renderizar pins atuais
      pins.forEach((pin) => {
        renderPin(pin);
      });

      // Ajustar bounds se houver pins
      if (pins.length > 0) {
        const latLngs = pins.map((p) => [p.lat, p.lng] as [number, number]);
        const bounds = window.L.latLngBounds(latLngs);
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [pins, loading, mapMode]);

  // Helper para gerar o HTML do popup do pin
  const getPopupContent = (id: string, title: string, description: string) => {
    if (isMissing) {
      return `
        <div style="min-width: 210px; font-family: ui-monospace, monospace; background: #e8ddcb; color: #1c1917; padding: 10px; border-left: 4px solid #b45309; border-radius: 2px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
          <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #78350f; border-bottom: 1px dashed #a8a29e; padding-bottom: 4px; margin-bottom: 6px;">
            [ EVIDÊNCIA / LOCALIZAÇÃO ]
          </div>
          <h4 style="margin: 0 0 4px 0; color: #1c1917; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">${escapeHtml(title)}</h4>
          <p style="margin: 0 0 10px 0; color: #44403c; font-size: 11px; line-height: 1.4; white-space: pre-wrap;">${escapeHtml(description)}</p>
          <button data-pin-id="${id}" style="background: #292524; color: #f5f5f4; border: 1px solid #78716c; padding: 4px 8px; border-radius: 2px; cursor: pointer; font-size: 10px; font-family: monospace; font-weight: bold; width: 100%; text-transform: uppercase; letter-spacing: 0.05em;">Descartar Registro</button>
        </div>
      `;
    }
    return `
      <div style="min-width: 200px;">
        <h4 style="margin: 0 0 8px 0; color: #e0e0e0; font-size: 14px;">${escapeHtml(title)}</h4>
        <p style="margin: 0 0 12px 0; color: #b0b0b0; font-size: 12px;">${escapeHtml(description)}</p>
        <button data-pin-id="${id}" style="background: #7c3aed; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; width: 100%;">Excluir</button>
      </div>
    `;
  };

  // Renderizar um pin no mapa
  const renderPin = (pin: MapPin) => {
    if (!mapInstanceRef.current || !window.L) return;

    const marker = window.L.marker([pin.lat, pin.lng]).addTo(mapInstanceRef.current);
    const popupContent = getPopupContent(pin.id, pin.title, pin.description);

    marker.bindPopup(popupContent);

    marker.on("popupopen", () => {
      const deleteBtn = document.querySelector(`button[data-pin-id="${pin.id}"]`);
      if (deleteBtn) {
        deleteBtn.addEventListener("click", (e: Event) => {
          e.stopPropagation();
          removePin(pin.id);
        });
      }
    });
  };

  // Adicionar novo pin
  const addPin = (lat: number, lng: number) => {
    const title = prompt("Título do local:");
    if (!title) return;

    const description = prompt("Descrição do local:", "");
    if (description === null) return;

    const newPin: MapPin = {
      id: generateUUID(),
      worldId,
      lat,
      lng,
      title,
      description,
      createdAt: new Date(),
    };

    setPins((prev) => [...prev, newPin]);

    // Mostrar popup automaticamente
    if (mapInstanceRef.current && window.L) {
      const marker = window.L.marker([lat, lng]).addTo(mapInstanceRef.current);
      const popupContent = getPopupContent(newPin.id, title, description);
      marker.bindPopup(popupContent);
      marker.openPopup();
    }
  };

  // Remover pin
  const removePin = (pinId: string) => {
    // Remover do mapa
    if (mapInstanceRef.current) {
      mapInstanceRef.current.eachLayer((layer: any) => {
        // Verificar se é um marker com este pinId no popup
        const popupContent = layer.getPopup()?.getContent() || "";
        if (popupContent.includes(`data-pin-id="${pinId}"`)) {
          mapInstanceRef.current.removeLayer(layer);
        }
      });
    }

    // Remover do estado
    setPins((prev) => prev.filter((p) => p.id !== pinId));
  };

  // Salvar todos os pins
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch(`/api/worlds/${worldId}/pins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pins }),
        credentials: "include",
      });
      alert("Mapa salvo com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar:", err);
      alert("Erro ao salvar o mapa");
    } finally {
      setIsSaving(false);
    }
  };

  // Helper para escapar HTML
  const escapeHtml = (text: string) => {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center">
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => setLoading(false)}
          className="mt-4 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-lg ${
        isMissing
          ? "border-2 border-zinc-700 bg-[#0d0e11]"
          : "bg-gray-950"
      }`}
    >
      {/* Container do Mapa */}
      <div
        ref={mapContainerRef}
        className={`h-full w-full ${
          isMissing ? "contrast-[1.08] saturate-[0.75] sepia-[0.18]" : ""
        }`}
      />

      {/* Toolbar superior */}
      <div className="absolute top-2 left-1/2 z-[500] -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-auto">
        {isMissing && (
          <div className="rounded border border-zinc-700 bg-zinc-950/90 px-3 py-0.5 text-center shadow-lg backdrop-blur">
            <span className="font-mono text-[10px] font-black uppercase tracking-wider text-amber-400">
              [ MAPA DE CAMPO // TOPOGRAFIA DE INVESTIGAÇÃO — CONFIDENCIAL ]
            </span>
          </div>
        )}
        <div
          className={`flex items-center gap-2 rounded-lg backdrop-blur px-4 py-2 shadow-lg ${
            isMissing
              ? "border border-zinc-700 bg-zinc-900/90 font-mono text-zinc-300"
              : "border border-purple-700/50 bg-gray-900/90 text-purple-300"
          }`}
        >
          <span className={`text-xs font-semibold ${isMissing ? "text-zinc-300" : "text-purple-300"}`}>
            {mapMode === "custom"
              ? isMissing
                ? "Cartografia de arquivo"
                : "Mapa customizado"
              : isMissing
              ? "Topografia global"
              : "Mapa global"}
          </span>
          <div className="h-4 w-px bg-zinc-700" />
          <span className={`text-xs font-semibold ${isMissing ? "text-amber-400" : "text-cyan-400"}`}>
            {pins.length} {isMissing ? (pins.length !== 1 ? "pontos de evidência" : "ponto de evidência") : `pin${pins.length !== 1 ? "s" : ""}`}
          </span>
          <div className="h-4 w-px bg-zinc-700" />
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isMissing
                ? "bg-zinc-800 border border-zinc-600 text-zinc-200 hover:bg-zinc-700 font-mono"
                : "bg-purple-600 text-white hover:bg-purple-500"
            }`}
          >
            {isSaving ? (
              <>
                <Spinner size="sm" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5"
                >
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                <span>{isMissing ? "Salvar Posições" : "Salvar Mapa"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Instrução flutuante */}
      <div className="absolute bottom-4 left-4 z-[500] pointer-events-none">
        <div
          className={`rounded-lg backdrop-blur p-3 shadow-lg max-w-sm ${
            isMissing
              ? "border border-zinc-700 bg-zinc-950/90 text-zinc-400 font-mono"
              : "border border-gray-700 bg-gray-900/90 text-gray-400"
          }`}
        >
          <p className="text-xs">
            {isMissing
              ? "Topografia de campo: arraste para escanear a área. Botão direito para demarcar ponto de interesse ou evidência."
              : "Clique e arraste para navegar no mapa. Clique direito para adicionar um local. Use os pins para marcar pontos de interesse."}
          </p>
        </div>
      </div>
    </div>
  );
}
