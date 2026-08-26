"use client";

import { useRef, useState } from "react";

type WorldImageUploadProps = {
  worldId: string;
  type: "cover" | "map";
  currentImageUrl: string | null;
  label?: string;
  onUploaded: (imageUrl: string, type: "cover" | "map") => void;
  className?: string;
};

export function WorldImageUpload({
  worldId,
  type,
  currentImageUrl,
  label,
  onUploaded,
  className = "",
}: WorldImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultLabel = type === "cover" ? "Imagem de Capa" : "Imagem de Mapa";
  const displayLabel = label || defaultLabel;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("type", type);

      const response = await fetch(`/api/worlds/${worldId}/image`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao enviar imagem");
        return;
      }

      const updatedUrl = type === "cover" ? data.data.coverUrl : data.data.mapUrl;
      onUploaded(updatedUrl, type);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {displayLabel && (
        <span className="block text-xs font-medium text-secondary-muted">
          {displayLabel}
        </span>
      )}

      <div className="flex items-center gap-3">
        {currentImageUrl ? (
          <div className="relative h-12 w-20 overflow-hidden rounded border border-secondary-border bg-dominant-dark shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentImageUrl}
              alt={displayLabel}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex h-12 w-20 items-center justify-center rounded border border-dashed border-secondary-border bg-dominant-dark text-[10px] text-secondary-muted">
            Sem {type === "cover" ? "capa" : "mapa"}
          </div>
        )}

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="rounded border border-secondary-border bg-dominant-dark px-2.5 py-1 text-xs font-medium text-secondary-pure hover:border-accent-vibrant hover:text-accent-hover disabled:opacity-50 transition-colors"
          >
            {isUploading
              ? "Enviando..."
              : currentImageUrl
              ? `Trocar ${type === "cover" ? "Capa" : "Mapa"}`
              : `Upload ${type === "cover" ? "Capa" : "Mapa"}`}
          </button>
          <p className="mt-0.5 text-[10px] text-secondary-muted">
            JPG, PNG ou WEBP · máx. 5MB
          </p>
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
