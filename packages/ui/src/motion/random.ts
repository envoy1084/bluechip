/** A seeded random generator (mulberry32) returning numbers in 0..1, so scenes look the same on every load. */
export const seededRandom = (seed: number): () => number => {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let x = Math.imul(state ^ (state >>> 15), 1 | state)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

/** A fresh seed for effects that should differ each time they play (confetti, scramble). */
export const randomSeed = (): number => Math.floor(Math.random() * 1e9)
