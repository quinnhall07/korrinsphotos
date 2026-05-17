export type ImageVariant = "thumbnail" | "gallery" | "download" | "public";

export async function uploadToCloudflareImages(
  r2ObjectUrl: string,
  metadata?: Record<string, string>
): Promise<{ imageId: string; deliveryUrl: string }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
  const apiToken = process.env.CLOUDFLARE_IMAGES_API_TOKEN!;

  const formData = new FormData();
  formData.append("url", r2ObjectUrl);
  if (metadata) {
    formData.append("metadata", JSON.stringify(metadata));
  }
  formData.append("requireSignedURLs", "false");

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      body: formData,
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Cloudflare Images upload failed: ${error}`);
  }

  const data = await res.json();
  const imageId = data.result.id as string;
  const deliveryUrl = `${process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGES_URL}/${imageId}`;

  return { imageId, deliveryUrl };
}

export async function deleteFromCloudflareImages(
  imageId: string
): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
  const apiToken = process.env.CLOUDFLARE_IMAGES_API_TOKEN!;

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${imageId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiToken}` },
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Cloudflare Images delete failed: ${error}`);
  }
}

export function buildCdnUrl(
  cloudflareImageId: string,
  variant: ImageVariant = "gallery"
): string {
  const base = process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGES_URL;
  return `${base}/${cloudflareImageId}/${variant}`;
}
