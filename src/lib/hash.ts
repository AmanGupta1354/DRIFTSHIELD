/**
 * SIMULATED hash chain for the audit demo. cyrb53 is a fast non-cryptographic hash — it only illustrates how each
 * record commits to its predecessor. It is NOT tamper-proof and must not be used for real integrity guarantees.
 */
export function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

export const GENESIS = '0000000000000000';

export interface ChainedRecord<T> {
  item: T;
  prevHash: string;
  hash: string;
}

export function chain<T extends { event_id: string; ts: number }>(items: T[], payload: (t: T) => string): ChainedRecord<T>[] {
  const out: ChainedRecord<T>[] = [];
  let prev = GENESIS;
  for (const item of items) {
    const hash = cyrb53(prev + '|' + payload(item));
    out.push({ item, prevHash: prev, hash });
    prev = hash;
  }
  return out;
}
