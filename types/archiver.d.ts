// types/archiver.d.ts
// Module augmentation for archiver v8 (ESM, named exports).
// The published `@types/archiver` package is still on the v7 shape
// (`export = archiver` with a default callable), so it doesn't expose
// the new named class exports. We augment the module with just the
// class shape we use server-side for the gallery zip route.

import type archiver from "archiver";

declare module "archiver" {
  export class ZipArchive {
    constructor(options?: archiver.ArchiverOptions);
    append(
      source: NodeJS.ReadableStream | Buffer | string,
      data?: archiver.EntryData | archiver.ZipEntryData
    ): this;
    finalize(): Promise<void>;
    abort(): this;
    on(event: "data", listener: (chunk: Buffer) => void): this;
    on(event: "end", listener: () => void): this;
    on(event: "warning" | "error", listener: (err: Error) => void): this;
    on(event: string, listener: (...args: unknown[]) => void): this;
  }
}
