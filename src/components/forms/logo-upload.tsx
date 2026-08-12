"use client";

import { useRef, useState } from "react";
import { ImageUp, Loader2, X } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

/**
 * Drop a file, pick one, or paste a URL.
 *
 * The URL field stays visible rather than hiding behind a toggle: uploads
 * require a configured Blob store, and a control that silently fails when
 * storage is missing leaves someone stuck with no route forward. Both paths
 * write to the same hidden input, so the server action doesn't know or care
 * which was used.
 */
export function LogoUpload({
  name = "logoUrl",
  brandId,
  brandName,
  initialUrl,
  accentColor,
  label,
  hint,
}: {
  name?: string;
  brandId?: string;
  brandName: string;
  initialUrl?: string | null;
  accentColor: string;
  label: string;
  hint: string;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      if (brandId) body.set("brandId", brandId);

      const response = await fetch("/api/upload/logo", { method: "POST", body });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      setUrl(data.url);
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="eyebrow">{label}</label>

      {/* The hidden field is the only thing the form actually submits. */}
      <input type="hidden" name={name} value={url} />

      <div className="mt-1.5 flex items-start gap-4">
        <BrandMark
          name={brandName || "??"}
          logoUrl={url || null}
          accentColor={accentColor}
          size="lg"
        />

        <div className="min-w-0 flex-1 space-y-2">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void upload(file);
            }}
            className={cn(
              "flex items-center gap-3 rounded-md border border-dashed px-3 py-2.5 transition-colors",
              dragging ? "border-brand bg-brand/5" : "border-line-strong",
            )}
          >
            {uploading ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-muted" aria-hidden />
            ) : (
              <ImageUp className="size-4 shrink-0 text-muted" aria-hidden />
            )}

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="text-sm font-medium text-brand hover:underline disabled:opacity-50"
            >
              Choose a file
            </button>
            <span className="text-xs text-muted">or drop one here</span>

            {url && !uploading && (
              <button
                type="button"
                onClick={() => setUrl("")}
                className="ms-auto inline-flex items-center gap-1 text-xs text-muted hover:text-critical"
              >
                <X className="size-3" aria-hidden />
                Remove
              </button>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }}
            />
          </div>

          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="…or paste an image URL"
            className="h-9 w-full rounded-md border border-line bg-surface px-3 text-sm outline-none transition-colors focus:border-brand"
          />

          <p className="text-xs text-muted">{hint}</p>
          {error && <p className="text-xs text-critical">{error}</p>}
        </div>
      </div>
    </div>
  );
}
