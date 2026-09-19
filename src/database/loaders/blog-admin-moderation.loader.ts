import { count, eq, or } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { blogComments, blogPostReviews, blogReports, blogPosts } from "@database/schemas";

export async function getBlogAdminModerationCount() {
  const db = getDrizzle();
  const [comments, reviews, postReports, commentReports, reviewReports] = await Promise.all([
    db.select({ count: count() }).from(blogComments).innerJoin(blogPosts, eq(blogPosts.id, blogComments.postId)).where(or(eq(blogComments.status, "PENDING"), eq(blogComments.status, "SPAM"))),
    db.select({ count: count() }).from(blogPostReviews).innerJoin(blogPosts, eq(blogPosts.id, blogPostReviews.postId)).where(eq(blogPostReviews.status, "PENDING")),
    db.select({ count: count() }).from(blogReports).innerJoin(blogPosts, eq(blogPosts.id, blogReports.postId)).where(eq(blogReports.status, "PENDING")),
    db.select({ count: count() }).from(blogReports).innerJoin(blogComments, eq(blogComments.id, blogReports.commentId)).innerJoin(blogPosts, eq(blogPosts.id, blogComments.postId)).where(eq(blogReports.status, "PENDING")),
    db.select({ count: count() }).from(blogReports).innerJoin(blogPostReviews, eq(blogReports.reviewId, blogPostReviews.id)).innerJoin(blogPosts, eq(blogPosts.id, blogPostReviews.postId)).where(eq(blogReports.status, "PENDING")),
  ]);

  return Number(comments[0]?.count ?? 0)
    + Number(reviews[0]?.count ?? 0)
    + Number(postReports[0]?.count ?? 0)
    + Number(commentReports[0]?.count ?? 0)
    + Number(reviewReports[0]?.count ?? 0);
}
