"use client";

import { useRef, useState } from "react";

type ImageUploadProps = {
  characterId: string;
  currentImageUrl: string | null;
  characterName: string;
  onUploaded: (imageUrl: string) => void;
  size?: "sm" | "lg";
};

export function ImageUpload({
  characterId,
  currentImageUrl,
  characterName,
  onUploaded,
  size = "lg",
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatarSize = size === "lg" ? "h-20 w-20 text-3xl" : "h-14 w-14 text-xl";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch(`/api/characters/${characterId}/image`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao enviar imagem");
        return;
      }

      onUploaded(data.data.imageUrl);
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
    <div>
      <div className="flex items-center gap-4">
        {currentImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentImageUrl}
            alt={characterName}
            className={`${avatarSize} rounded-full object-cover`}
          />
        ) : (
          <div
            className={`${avatarSize} flex items-center justify-center rounded-full bg-gray-800 font-bold text-gray-400`}
          >
            {characterName.charAt(0).toUpperCase()}
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
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-300 hover:border-blue-500 hover:text-blue-400 disabled:opacity-50"
          >
            {isUploading ? "Enviando..." : currentImageUrl ? "Trocar imagem" : "Adicionar imagem"}
          </button>
          <p className="mt-1 text-xs text-gray-500">JPG, PNG ou WEBP · máx. 5MB</p>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
