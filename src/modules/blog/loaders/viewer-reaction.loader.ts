/**
 * Réaction du visiteur sur un article.
 *
 * Les compteurs sont publics, mais la réaction d'un lecteur connecté ne l'est
 * pas : sans elle, la barre s'affichait toujours inactive après rechargement et
 * l'utilisateur ne savait plus s'il avait déjà réagi. Cette donnée est propre à
 * la session, donc hors du cache de `getBlogPostBySlug`.
 */
import { and, eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { blogPostReactions } from "@database/schemas";
import type { BlogReactionType } from "@/lib/blog/constants";

export async function getBlogViewerReaction(
  postId: string,
  viewerId: string | null,
): Promise<BlogReactionType | null> {
  if (!viewerId) return null;

  const db = getDrizzle();
  const rows = await db
    .select({ reactionType: blogPostReactions.reactionType })
    .from(blogPostReactions)
    .where(
      and(
        eq(blogPostReactions.postId, postId),
        eq(blogPostReactions.userId, viewerId),
      ),
    )
    .limit(1);

  return rows[0]?.reactionType ?? null;
}
