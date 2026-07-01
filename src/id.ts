type CryptoLike = {
  randomUUID?: () => string;
};

export function createId(
  cryptoLike: CryptoLike | undefined = globalThis.crypto,
  now: () => number = Date.now
): string {
  if (typeof cryptoLike?.randomUUID === "function") {
    return cryptoLike.randomUUID();
  }

  return `meal-${now()}-${Math.random().toString(36).slice(2, 10)}`;
}
