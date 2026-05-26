"use client";

import { useRef, useState, useCallback } from "react";
import { Camera, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api";

interface AvatarUploadProps {
  currentAvatarUrl: string | null;
  userName: string;
  onAvatarChange: (url: string | null) => void;
}

export function AvatarUpload({
  currentAvatarUrl,
  userName,
  onAvatarChange,
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) {
        setError("Apenas imagens PNG ou JPG são permitidas.");
        return;
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("A imagem deve ter no máximo 5MB.");
        return;
      }

      setError(null);
      setIsUploading(true);

      // Create local preview immediately
      const localPreview = URL.createObjectURL(file);
      setPreviewUrl(localPreview);

      try {
        const updatedUser = await authApi.uploadAvatar(file);
        onAvatarChange(updatedUser.avatar_url);
        setPreviewUrl(updatedUser.avatar_url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao fazer upload do avatar.");
        // Revert to previous avatar on error
        setPreviewUrl(currentAvatarUrl);
      } finally {
        setIsUploading(false);
        // Clean up object URL to avoid memory leaks
        URL.revokeObjectURL(localPreview);
        // Reset input so the same file can be selected again
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [currentAvatarUrl, onAvatarChange]
  );

  const handleDelete = useCallback(async () => {
    if (!previewUrl) return;

    if (!window.confirm("Remover foto de perfil?")) return;

    setIsUploading(true);
    setError(null);

    try {
      const updatedUser = await authApi.deleteAvatar();
      onAvatarChange(updatedUser.avatar_url);
      setPreviewUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover avatar.");
    } finally {
      setIsUploading(false);
    }
  }, [previewUrl, onAvatarChange]);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar Display */}
      <div className="relative group">
        <div
          className={`h-24 w-24 rounded-full overflow-hidden border-2 border-[var(--border)] bg-[var(--background-subtle)] flex items-center justify-center transition-opacity ${
            isUploading ? "opacity-70" : "opacity-100"
          }`}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={userName}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-2xl font-bold text-[var(--text-muted)]">
              {getInitials(userName)}
            </span>
          )}
        </div>

        {/* Upload overlay on hover */}
        {!isUploading && (
          <button
            onClick={triggerFileInput}
            className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            title="Alterar foto"
          >
            <Camera className="h-6 w-6 text-white" />
          </button>
        )}

        {/* Loading spinner */}
        {isUploading && (
          <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={triggerFileInput}
          disabled={isUploading}
          className="text-xs"
        >
          <Camera className="h-3.5 w-3.5 mr-1" />
          {previewUrl ? "Trocar foto" : "Adicionar foto"}
        </Button>

        {previewUrl && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            disabled={isUploading}
            className="text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Remover
          </Button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-500 font-mono text-center max-w-[200px]">
          {error}
        </p>
      )}

      <p className="text-[10px] text-[var(--text-muted)] font-mono text-center">
        PNG ou JPG · Máx 5MB
      </p>
    </div>
  );
}
