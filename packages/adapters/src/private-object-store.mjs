import { mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const KEY = /^hero\/uploads\/[a-z][a-z0-9-]{2,62}\/[A-Za-z][A-Za-z0-9._:-]{2,127}\/[a-f0-9]{64}$/;

export class PrivateObjectStoreError extends Error {
  constructor(code, message) { super(message); this.name = "PrivateObjectStoreError"; this.code = code; }
}

/**
 * A deliberately small local object-store adapter for the Hero-owned data
 * volume. It accepts only project upload keys, never exposes a listing API and
 * rejects every path that could escape the configured private root.
 */
export function createPrivateObjectStore({ root }) {
  if (typeof root !== "string" || !path.isAbsolute(root)) throw new PrivateObjectStoreError("OBJECT_STORE_ROOT_INVALID", "A private absolute object-store root is required.");
  const rootPath = path.resolve(root);
  mkdirSync(rootPath, { recursive: true, mode: 0o700 });
  function target(objectKey) {
    if (typeof objectKey !== "string" || !KEY.test(objectKey)) throw new PrivateObjectStoreError("OBJECT_STORE_KEY_INVALID", "Object key is not a valid Hero private upload key.");
    const destination = path.resolve(rootPath, objectKey);
    if (!destination.startsWith(`${rootPath}${path.sep}`)) throw new PrivateObjectStoreError("OBJECT_STORE_PATH_ESCAPE", "Object key escaped the private root.");
    return destination;
  }
  return Object.freeze({
    put({ objectKey, bytes }) {
      if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw new PrivateObjectStoreError("OBJECT_STORE_BYTES_INVALID", "A non-empty Buffer is required.");
      const destination = target(objectKey);
      mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
      const temporary = `${destination}.${randomUUID()}.tmp`;
      try {
        writeFileSync(temporary, bytes, { mode: 0o600, flag: "wx" });
        renameSync(temporary, destination);
      } finally {
        try { unlinkSync(temporary); } catch { /* rename completed or write failed */ }
      }
      const stored = statSync(destination);
      if (stored.size !== bytes.length) throw new PrivateObjectStoreError("OBJECT_STORE_WRITE_INCOMPLETE", "Private object write length did not match input.");
      return Object.freeze({ objectKey, byteLength: stored.size, storage: "hero-private-volume" });
    },
    read({ objectKey }) { return Buffer.from(readFileSync(target(objectKey))); },
    metadata({ objectKey }) { const stored = statSync(target(objectKey)); return Object.freeze({ objectKey, byteLength: stored.size, storage: "hero-private-volume" }); },
    delete({ objectKey }) {
      const destination = target(objectKey);
      try { unlinkSync(destination); } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      return Object.freeze({ objectKey, deleted: true });
    }
  });
}
