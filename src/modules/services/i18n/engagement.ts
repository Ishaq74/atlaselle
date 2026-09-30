import type { Locale } from "@i18n/config";

export type ServiceEngagementTranslations = {
  favorite: string;
  unfavorite: string;
  reactionLabel: string;
  reactionTypes: { LIKE: string; LOVE: string; FIRE: string; CLAP: string };
  reviewTitle: string;
  reviewRating: string;
  /** Label + placeholder du champ « titre » de l'avis. */
  reviewTitlePlaceholder: string;
  /** Message d'erreur quand aucune note n'est sélectionnée. */
  ratingRequired: string;
  reviewContent: string;
  reviewRecommended: string;
  /** Formulation NÉGATIVE affichée sur le badge rouge d'un avis négatif. */
  notRecommended: string;
  /** Libellé du bouton « répondre », distinct du titre de la section. */
  reviewReply: string;
  submitReview: string;
  commentTitle: string;
  commentContent: string;
  submitComment: string;
  noReviews: string;
  noComments: string;
  pendingModeration: string;
  helpful: string;
  helpfulMark: string;
  helpfulUnmark: string;
  report: string;
  success: string;
  error: string;
  /** Nom affiché quand l'auteur d'un commentaire ou d'un avis n'est plus connu. */
  anonymous: string;
  signInRequired: string;
  /** Libellés de la barre de partage (atome `Engagement/ShareBar`). */
  share: string;
  shareOnX: string;
  shareOnFacebook: string;
  shareOnLinkedIn: string;
  copyLink: string;
  linkCopied: string;
  copyLinkError: string;
  admin: { moderation: string; categories: string; tags: string; create: string; save: string; delete: string; approve: string; reject: string; spam: string; trash: string; resolve: string; noPending: string; name: string; slug: string; parent: string };
};

const translations: Record<Locale, ServiceEngagementTranslations> = {
  fr: { favorite: "Ajouter aux favoris", unfavorite: "Retirer des favoris", reactionLabel: "Réagir", reactionTypes: { LIKE: "J'aime", LOVE: "J'adore", FIRE: "Excellent", CLAP: "Bravo" }, reviewTitle: "Avis", reviewRating: "Note", reviewTitlePlaceholder: "Titre de votre avis", ratingRequired: "Veuillez sélectionner une note", reviewContent: "Votre avis", reviewRecommended: "Je recommande ce service", submitReview: "Publier l'avis", commentTitle: "Commentaires", commentContent: "Votre commentaire", submitComment: "Publier le commentaire", noReviews: "Aucun avis pour le moment.", noComments: "Aucun commentaire pour le moment.", pendingModeration: "Votre contribution est en attente de modération.", helpful: "Utile", helpfulMark: "Marquer comme utile", helpfulUnmark: "Retirer le vote utile", report: "Signaler", success: "Enregistré.", error: "Une erreur est survenue.", anonymous: "Anonyme", signInRequired: "Connectez-vous pour publier", share: "Partager", shareOnX: "Partager sur X", shareOnFacebook: "Partager sur Facebook", shareOnLinkedIn: "Partager sur LinkedIn", copyLink: "Copier le lien", linkCopied: "Lien copié.", copyLinkError: "Impossible de copier le lien.", notRecommended: "Je ne recommande pas ce service", reviewReply: "Répondre", admin: { moderation: "Modération", categories: "Catégories", tags: "Tags", create: "Créer", save: "Enregistrer", delete: "Supprimer", approve: "Approuver", reject: "Rejeter", spam: "Spam", trash: "Corbeille", resolve: "Résoudre", noPending: "Aucun élément en attente.", name: "Nom", slug: "Slug", parent: "Parent" } },
  en: { favorite: "Add to favorites", unfavorite: "Remove from favorites", reactionLabel: "React", reactionTypes: { LIKE: "Like", LOVE: "Love", FIRE: "Excellent", CLAP: "Clap" }, reviewTitle: "Reviews", reviewRating: "Rating", reviewTitlePlaceholder: "Review title", ratingRequired: "Please select a rating", reviewContent: "Your review", reviewRecommended: "I recommend this service", submitReview: "Submit review", commentTitle: "Comments", commentContent: "Your comment", submitComment: "Submit comment", noReviews: "No reviews yet.", noComments: "No comments yet.", pendingModeration: "Your contribution is awaiting moderation.", helpful: "Helpful", helpfulMark: "Mark helpful", helpfulUnmark: "Remove helpful vote", report: "Report", success: "Saved.", error: "Something went wrong.", anonymous: "Anonymous", signInRequired: "Sign in to post", share: "Share", shareOnX: "Share on X", shareOnFacebook: "Share on Facebook", shareOnLinkedIn: "Share on LinkedIn", copyLink: "Copy link", linkCopied: "Link copied.", copyLinkError: "Could not copy the link.", notRecommended: "I do not recommend this service", reviewReply: "Reply", admin: { moderation: "Moderation", categories: "Categories", tags: "Tags", create: "Create", save: "Save", delete: "Delete", approve: "Approve", reject: "Reject", spam: "Spam", trash: "Trash", resolve: "Resolve", noPending: "Nothing pending.", name: "Name", slug: "Slug", parent: "Parent" } },
  es: { favorite: "Añadir a favoritos", unfavorite: "Quitar de favoritos", reactionLabel: "Reaccionar", reactionTypes: { LIKE: "Me gusta", LOVE: "Me encanta", FIRE: "Excelente", CLAP: "Aplausos" }, reviewTitle: "Reseñas", reviewRating: "Puntuación", reviewTitlePlaceholder: "Título de tu reseña", ratingRequired: "Selecciona una valoración", reviewContent: "Tu reseña", reviewRecommended: "Recomiendo este servicio", submitReview: "Publicar reseña", commentTitle: "Comentarios", commentContent: "Tu comentario", submitComment: "Publicar comentario", noReviews: "Aún no hay reseñas.", noComments: "Aún no hay comentarios.", pendingModeration: "Tu contribución está pendiente de moderación.", helpful: "Útil", helpfulMark: "Marcar como útil", helpfulUnmark: "Quitar voto útil", report: "Reportar", success: "Guardado.", error: "Ocurrió un error.", anonymous: "Anónimo", signInRequired: "Inicia sesión para publicar", share: "Compartir", shareOnX: "Compartir en X", shareOnFacebook: "Compartir en Facebook", shareOnLinkedIn: "Compartir en LinkedIn", copyLink: "Copiar enlace", linkCopied: "Enlace copiado.", copyLinkError: "No se pudo copiar el enlace.", notRecommended: "No recomiendo este servicio", reviewReply: "Responder", admin: { moderation: "Moderación", categories: "Categorías", tags: "Etiquetas", create: "Crear", save: "Guardar", delete: "Eliminar", approve: "Aprobar", reject: "Rechazar", spam: "Spam", trash: "Papelera", resolve: "Resolver", noPending: "No hay elementos pendientes.", name: "Nombre", slug: "Slug", parent: "Padre" } },
  ar: { favorite: "إضافة إلى المفضلة", unfavorite: "إزالة من المفضلة", reactionLabel: "تفاعل", reactionTypes: { LIKE: "إعجاب", LOVE: "أحببت", FIRE: "ممتاز", CLAP: "تصفيق" }, reviewTitle: "التقييمات", reviewRating: "التقييم", reviewTitlePlaceholder: "عنوان التقييم", ratingRequired: "يرجى اختيار تقييم", reviewContent: "مراجعتك", reviewRecommended: "أوصي بهذه الخدمة", submitReview: "نشر التقييم", commentTitle: "التعليقات", commentContent: "تعليقك", submitComment: "نشر التعليق", noReviews: "لا توجد تقييمات بعد.", noComments: "لا توجد تعليقات بعد.", pendingModeration: "مساهمتك بانتظار المراجعة.", helpful: "مفيد", helpfulMark: "وضع علامة مفيد", helpfulUnmark: "إزالة التصويت", report: "إبلاغ", success: "تم الحفظ.", error: "حدث خطأ.", anonymous: "مجهول", signInRequired: "سجّل الدخول للنشر", share: "مشاركة", shareOnX: "المشاركة على X", shareOnFacebook: "المشاركة على فيسبوك", shareOnLinkedIn: "المشاركة على لينكدإن", copyLink: "نسخ الرابط", linkCopied: "تم نسخ الرابط.", copyLinkError: "تعذر نسخ الرابط.", notRecommended: "لا أوصي بهذه الخدمة", reviewReply: "ردّ", admin: { moderation: "الإشراف", categories: "الفئات", tags: "الوسوم", create: "إنشاء", save: "حفظ", delete: "حذف", approve: "موافقة", reject: "رفض", spam: "مزعج", trash: "سلة المهملات", resolve: "حل", noPending: "لا توجد عناصر معلقة.", name: "الاسم", slug: "المعرف", parent: "الأب" } },
};

export function getServiceEngagementTranslations(locale: Locale): ServiceEngagementTranslations { return translations[locale] ?? translations.fr; }
