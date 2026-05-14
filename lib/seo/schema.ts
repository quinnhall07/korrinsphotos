// lib/seo/schema.ts
// JSON-LD schema builders for SEO. Pure functions returning schema.org-shaped
// plain objects. Safe to import from Server Components and Server Actions.
// No external deps, no I/O — see roadmap Phase 4.12.

/**
 * Site-wide brand constants used by every schema builder. Address/phone are
 * intentionally omitted (not yet public on the marketing site) and may be
 * filled in once Korrin confirms them. The values here mirror what visitors
 * already see on the homepage/footer/booking form.
 */
const BRAND_NAME    = "Korrin's Photography";
const BRAND_TAGLINE =
  "Fine art photography for weddings, portraits, and editorial work — crafted with intention and an eye for the extraordinary.";
const BRAND_AREA    = "Cary / Raleigh-Durham area, North Carolina";

function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw && raw.length > 0) return raw.replace(/\/$/, "");
  return "https://korrinsphotos.com";
}

function absoluteUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = siteUrl();
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}

// ---------------------------------------------------------------------------
// Photographer / LocalBusiness — site-wide (root layout)
// ---------------------------------------------------------------------------

export interface PhotographerSchema {
  "@context": "https://schema.org";
  "@type":    "Photographer";
  name:       string;
  url:        string;
  description: string;
  image:      string;
  areaServed: string;
  priceRange: string;
  sameAs?:    string[];
}

/**
 * Returns the site-wide Photographer JSON-LD payload. Conservative on fields
 * that aren't yet confirmed publicly (phone/address): we omit rather than
 * fabricate. `priceRange` is a coarse band ("$$") matching typical session
 * pricing tiers.
 */
export function buildPhotographerSchema(): PhotographerSchema {
  return {
    "@context":  "https://schema.org",
    "@type":     "Photographer",
    name:        BRAND_NAME,
    url:         siteUrl(),
    description: BRAND_TAGLINE,
    image:       absoluteUrl("/favicon.ico"),
    areaServed:  BRAND_AREA,
    priceRange:  "$$",
  };
}

// ---------------------------------------------------------------------------
// LocalBusiness — /locations/[citySlug] (city-scoped)
// ---------------------------------------------------------------------------

export interface LocalBusinessAddress {
  /** City the page is targeting, e.g. "Cary". Used for `addressLocality`. */
  city:    string;
  /** USPS state abbreviation, e.g. "NC". */
  state:   string;
  /** Country, defaults to "US" if omitted. */
  country?: string;
}

export interface LocalBusinessSchema {
  "@context":   "https://schema.org";
  "@type":      "LocalBusiness";
  "@id":        string;
  name:         string;
  url:          string;
  description:  string;
  image:        string;
  priceRange:   string;
  areaServed:   string[];
  address: {
    "@type":          "PostalAddress";
    addressLocality:  string;
    addressRegion:    string;
    addressCountry:   string;
  };
}

/**
 * Builds a city-scoped LocalBusiness JSON-LD payload for the
 * `/locations/[citySlug]` pages. The `@id` anchors per-city so multiple city
 * pages don't collapse into a single entity in Google's eyes.
 *
 * `areaServed` is an array — pass any nearby towns / regions the page also
 * implicitly serves so Google understands the geographic radius.
 */
export function buildLocalBusinessSchema(
  citySlug:   string,
  address:    LocalBusinessAddress,
  areaServed: string[],
  description?: string,
): LocalBusinessSchema {
  const pageUrl = absoluteUrl(`/locations/${citySlug}`);
  return {
    "@context":  "https://schema.org",
    "@type":     "LocalBusiness",
    "@id":       `${pageUrl}#localbusiness`,
    name:        `${BRAND_NAME} — ${address.city}, ${address.state}`,
    url:         pageUrl,
    description: description ?? BRAND_TAGLINE,
    image:       absoluteUrl("/favicon.ico"),
    priceRange:  "$$",
    areaServed:  areaServed.length > 0 ? areaServed : [`${address.city}, ${address.state}`],
    address: {
      "@type":          "PostalAddress",
      addressLocality:  address.city,
      addressRegion:    address.state,
      addressCountry:   address.country ?? "US",
    },
  };
}

// ---------------------------------------------------------------------------
// Service — /portfolio (optionally per category)
// ---------------------------------------------------------------------------

export interface ServiceSchema {
  "@context":     "https://schema.org";
  "@type":        "Service";
  serviceType:    string;
  name:           string;
  url:            string;
  areaServed:     string;
  provider: {
    "@type": "Photographer";
    name:    string;
    url:     string;
  };
  description:    string;
}

/**
 * Builds a Service schema for the public portfolio. If a category slug is
 * supplied (e.g. "wedding"), the service name is specialised; otherwise the
 * generic "Photography" service is returned.
 */
export function buildServiceSchema(category?: string | null): ServiceSchema {
  const normalised = (category ?? "").trim().toLowerCase();
  const labelMap: Record<string, string> = {
    wedding:   "Wedding Photography",
    portrait:  "Portrait Photography",
    editorial: "Editorial Photography",
    landscape: "Landscape Photography",
    family:    "Family Photography",
    engagement:"Engagement Photography",
    commercial:"Commercial Photography",
  };
  const serviceName  = labelMap[normalised] ?? "Photography";
  const portfolioUrl =
    normalised && labelMap[normalised]
      ? absoluteUrl(`/portfolio?category=${normalised}`)
      : absoluteUrl("/portfolio");

  return {
    "@context":  "https://schema.org",
    "@type":     "Service",
    serviceType: serviceName,
    name:        serviceName,
    url:         portfolioUrl,
    areaServed:  BRAND_AREA,
    provider: {
      "@type": "Photographer",
      name:    BRAND_NAME,
      url:     siteUrl(),
    },
    description: BRAND_TAGLINE,
  };
}

// ---------------------------------------------------------------------------
// BlogPosting — public journal posts (if/when shipped)
// ---------------------------------------------------------------------------

export interface BlogPostingImage {
  url:     string;
  caption?: string;
}

export interface BlogPostingInput {
  title:         string;
  slug:          string;
  datePublished: string | Date;
  body:          string;
  image:         string | BlogPostingImage | BlogPostingImage[];
  author?:       string;
}

export interface BlogPostingSchema {
  "@context":     "https://schema.org";
  "@type":        "BlogPosting";
  headline:       string;
  url:            string;
  datePublished:  string;
  articleBody:    string;
  author: {
    "@type": "Person";
    name:    string;
  };
  publisher: {
    "@type": "Organization";
    name:    string;
    url:     string;
  };
  image:          ImageObjectSchema[];
}

export interface ImageObjectSchema {
  "@type":  "ImageObject";
  url:      string;
  caption?: string;
}

function toIsoDate(d: string | Date): string {
  if (d instanceof Date) return d.toISOString();
  // If we were handed a date-only string ("2026-05-13"), preserve it; if it's
  // a full ISO string we leave it alone.
  return d;
}

function normaliseImages(
  image: BlogPostingInput["image"],
): ImageObjectSchema[] {
  const list = Array.isArray(image) ? image : [image];
  return list.map((img) => {
    if (typeof img === "string") {
      return { "@type": "ImageObject", url: absoluteUrl(img) };
    }
    const obj: ImageObjectSchema = {
      "@type": "ImageObject",
      url:     absoluteUrl(img.url),
    };
    if (img.caption) obj.caption = img.caption;
    return obj;
  });
}

export function buildBlogPostingSchema(
  input: BlogPostingInput,
): BlogPostingSchema {
  return {
    "@context":     "https://schema.org",
    "@type":        "BlogPosting",
    headline:       input.title,
    url:            absoluteUrl(`/journal/${input.slug}`),
    datePublished:  toIsoDate(input.datePublished),
    articleBody:    input.body,
    author: {
      "@type": "Person",
      name:    input.author ?? "Korrin",
    },
    publisher: {
      "@type": "Organization",
      name:    BRAND_NAME,
      url:     siteUrl(),
    },
    image: normaliseImages(input.image),
  };
}

// ---------------------------------------------------------------------------
// Product — /shop/[slug] (digital products store)
// ---------------------------------------------------------------------------

export interface ProductSchemaInput {
  name:        string;
  slug:        string;
  description: string;
  priceCents:  number;
  image?:      string | null;
  inStock?:    boolean;
}

export interface ProductSchema {
  "@context":   "https://schema.org";
  "@type":      "Product";
  name:         string;
  url:          string;
  description:  string;
  image?:       string;
  brand: {
    "@type": "Brand";
    name:    string;
  };
  offers: {
    "@type":         "Offer";
    url:             string;
    priceCurrency:   "USD";
    price:           string;
    availability:    string;
  };
}

export function buildProductSchema(input: ProductSchemaInput): ProductSchema {
  const url = absoluteUrl(`/shop/${input.slug}`);
  const priceDollars = (input.priceCents / 100).toFixed(2);
  const availability =
    input.inStock === false
      ? "https://schema.org/OutOfStock"
      : "https://schema.org/InStock";

  const schema: ProductSchema = {
    "@context":  "https://schema.org",
    "@type":     "Product",
    name:        input.name,
    url,
    description: input.description,
    brand: {
      "@type": "Brand",
      name:    BRAND_NAME,
    },
    offers: {
      "@type":       "Offer",
      url,
      priceCurrency: "USD",
      price:         priceDollars,
      availability,
    },
  };
  if (input.image) schema.image = absoluteUrl(input.image);
  return schema;
}

// ---------------------------------------------------------------------------
// BreadcrumbList — generic
// ---------------------------------------------------------------------------

export interface BreadcrumbInput {
  name: string;
  url:  string;
}

export interface BreadcrumbListSchema {
  "@context":         "https://schema.org";
  "@type":            "BreadcrumbList";
  itemListElement:    Array<{
    "@type":   "ListItem";
    position:  number;
    name:      string;
    item:      string;
  }>;
}

export function buildBreadcrumbSchema(
  crumbs: BreadcrumbInput[],
): BreadcrumbListSchema {
  return {
    "@context":      "https://schema.org",
    "@type":         "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type":  "ListItem",
      position: i + 1,
      name:     c.name,
      item:     absoluteUrl(c.url),
    })),
  };
}
