import { NextResponse } from "next/server";

import { isSuperAdmin, requireBrandAccess, requireUser } from "@/lib/rbac";

export const runtime = "nodejs";

/**
 * Brand logo upload.
 *
 * Storage is Vercel Blob, chosen because it needs no bucket, no IAM policy,
 * and no second vendor account — one environment variable and it works. The
 * package is imported dynamically so the app still builds and runs without it
 * installed; in that case the form falls back to pasting a URL, which is what
 * it did before.
 *
 * Uploads are validated server-side on type and size. Client-side checks are a
 * courtesy to the person, not a control: this endpoint has to assume the
 * request came from somewhere other than our own form.
 */

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export async function POST(request: Request) {
  const user = await requireUser();

  const form = await request.formData();
  const file = form.get("file");
  const brandId = String(form.get("brandId") ?? "");

  // New brands have no id yet, so creating one only requires admin rights.
  if (brandId) {
    await requireBrandAccess(brandId, "BRAND_ADMIN");
  } else if (!isSuperAdmin(user)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }

  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: "Use a PNG, JPEG, WebP, or SVG file." },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 2MB.` },
      { status: 400 },
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "File storage isn't configured. Add a Blob store in Vercel (Storage → Create → Blob), or paste an image URL instead.",
      },
      { status: 501 },
    );
  }

  try {
    const { put } = await import("@vercel/blob");
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";

    const blob = await put(`brand-logos/${brandId || "new"}-${Date.now()}.${extension}`, file, {
      access: "public",
      contentType: file.type,
      // Blob adds a random suffix by default, which is what stops one brand's
      // upload from overwriting another's when names collide.
      addRandomSuffix: true,
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/cannot find module|@vercel\/blob/i.test(message)) {
      return NextResponse.json(
        { error: "Run `npm install @vercel/blob` to enable uploads, or paste an image URL." },
        { status: 501 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
