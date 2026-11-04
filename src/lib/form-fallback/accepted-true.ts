import { z } from "astro/zod";

/**
 * Consentement explicite (`true`) accepté aussi depuis une case HTML cochée :
 * un `<input type="checkbox">` sans `value` envoie la chaîne "on", et Astro ne
 * convertit que les `z.boolean()` (pas `z.literal(true)`) lors d'une soumission
 * native. Une case décochée est absente du FormData → `null` → rejet.
 */
export const acceptedTrue = z.union([z.literal(true), z.literal("on").transform((): true => true)]);
