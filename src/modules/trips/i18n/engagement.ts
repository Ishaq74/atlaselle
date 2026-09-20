import type { Locale } from "@i18n/config";

export interface TripEngagementTranslations {
  favorite: string;
  unfavorite: string;
  reactionLabel: string;
  reactionTypes: { LIKE: string; LOVE: string; FIRE: string; CLAP: string };
  reviewTitle: string;
  reviewRating: string;
  reviewContent: string;
  reviewTitleLabel: string;
  reviewRecommended: string;
  submitReview: string;
  commentTitle: string;
  commentContent: string;
  submitComment: string;
  reply: string;
  noReviews: string;
  noComments: string;
  reviewsDisabled: string;
  commentsDisabled: string;
  commentsClosed: string;
  pendingModeration: string;
  helpful: string;
  helpfulMark: string;
  helpfulUnmark: string;
  report: string;
  reportSent: string;
  success: string;
  error: string;
  signInRequired: string;
  ratingLabel: string;
}

const translations: Record<Locale, TripEngagementTranslations> = {
  fr: {
    favorite: "Ajouter aux favoris",
    unfavorite: "Retirer des favoris",
    reactionLabel: "Réagir",
    reactionTypes: { LIKE: "J'aime", LOVE: "J'adore", FIRE: "Excellent", CLAP: "Bravo" },
    reviewTitle: "Avis voyageurs",
    reviewRating: "Note",
    reviewContent: "Votre avis",
    reviewTitleLabel: "Titre (optionnel)",
    reviewRecommended: "Je recommande ce voyage",
    submitReview: "Publier l'avis",
    commentTitle: "Questions & commentaires",
    commentContent: "Votre commentaire",
    submitComment: "Publier le commentaire",
    reply: "Répondre",
    noReviews: "Aucun avis pour le moment. Soyez la première à partager votre expérience.",
    noComments: "Aucun commentaire pour le moment.",
    reviewsDisabled: "Les avis sont désactivés pour ce voyage.",
    commentsDisabled: "Les commentaires sont désactivés pour ce voyage.",
    commentsClosed: "Les commentaires sont fermés. Vous pouvez lire les échanges existants.",
    pendingModeration: "Votre contribution est en attente de modération.",
    helpful: "Utile",
    helpfulMark: "Marquer comme utile",
    helpfulUnmark: "Retirer le vote utile",
    report: "Signaler",
    reportSent: "Signalement envoyé. Merci.",
    success: "Enregistré.",
    error: "Une erreur est survenue.",
    signInRequired: "Connectez-vous pour contribuer.",
    ratingLabel: "Note moyenne",
  },
  en: {
    favorite: "Add to favorites",
    unfavorite: "Remove from favorites",
    reactionLabel: "React",
    reactionTypes: { LIKE: "Like", LOVE: "Love", FIRE: "Excellent", CLAP: "Clap" },
    reviewTitle: "Traveller reviews",
    reviewRating: "Rating",
    reviewContent: "Your review",
    reviewTitleLabel: "Title (optional)",
    reviewRecommended: "I recommend this journey",
    submitReview: "Submit review",
    commentTitle: "Questions & comments",
    commentContent: "Your comment",
    submitComment: "Submit comment",
    reply: "Reply",
    noReviews: "No reviews yet. Be the first to share your experience.",
    noComments: "No comments yet.",
    reviewsDisabled: "Reviews are disabled for this journey.",
    commentsDisabled: "Comments are disabled for this journey.",
    commentsClosed: "Comments are closed. You can still read existing exchanges.",
    pendingModeration: "Your contribution is awaiting moderation.",
    helpful: "Helpful",
    helpfulMark: "Mark helpful",
    helpfulUnmark: "Remove helpful vote",
    report: "Report",
    reportSent: "Report sent. Thank you.",
    success: "Saved.",
    error: "Something went wrong.",
    signInRequired: "Sign in to contribute.",
    ratingLabel: "Average rating",
  },
  es: {
    favorite: "Añadir a favoritos",
    unfavorite: "Quitar de favoritos",
    reactionLabel: "Reaccionar",
    reactionTypes: { LIKE: "Me gusta", LOVE: "Me encanta", FIRE: "Excelente", CLAP: "Aplausos" },
    reviewTitle: "Opiniones de viajeras",
    reviewRating: "Puntuación",
    reviewContent: "Tu opinión",
    reviewTitleLabel: "Título (opcional)",
    reviewRecommended: "Recomiendo este viaje",
    submitReview: "Publicar opinión",
    commentTitle: "Preguntas y comentarios",
    commentContent: "Tu comentario",
    submitComment: "Publicar comentario",
    reply: "Responder",
    noReviews: "Aún no hay opiniones. Sé la primera en compartir tu experiencia.",
    noComments: "Aún no hay comentarios.",
    reviewsDisabled: "Las opiniones están desactivadas para este viaje.",
    commentsDisabled: "Los comentarios están desactivados para este viaje.",
    commentsClosed: "Los comentarios están cerrados. Puedes leer los intercambios existentes.",
    pendingModeration: "Tu contribución está pendiente de moderación.",
    helpful: "Útil",
    helpfulMark: "Marcar como útil",
    helpfulUnmark: "Quitar voto útil",
    report: "Reportar",
    reportSent: "Reporte enviado. Gracias.",
    success: "Guardado.",
    error: "Ocurrió un error.",
    signInRequired: "Inicia sesión para contribuir.",
    ratingLabel: "Nota media",
  },
  ar: {
    favorite: "إضافة إلى المفضلة",
    unfavorite: "إزالة من المفضلة",
    reactionLabel: "تفاعل",
    reactionTypes: { LIKE: "إعجاب", LOVE: "أحببت", FIRE: "ممتاز", CLAP: "تصفيق" },
    reviewTitle: "تقييمات المسافرات",
    reviewRating: "التقييم",
    reviewContent: "مراجعتك",
    reviewTitleLabel: "العنوان (اختياري)",
    reviewRecommended: "أوصي بهذه الرحلة",
    submitReview: "نشر التقييم",
    commentTitle: "الأسئلة والتعليقات",
    commentContent: "تعليقك",
    submitComment: "نشر التعليق",
    reply: "رد",
    noReviews: "لا توجد تقييمات بعد. كوني أول من يشارك تجربته.",
    noComments: "لا توجد تعليقات بعد.",
    reviewsDisabled: "التقييمات معطلة لهذه الرحلة.",
    commentsDisabled: "التعليقات معطلة لهذه الرحلة.",
    commentsClosed: "التعليقات مغلقة. يمكنك قراءة التبادلات الموجودة.",
    pendingModeration: "مساهمتك بانتظار المراجعة.",
    helpful: "مفيد",
    helpfulMark: "وضع علامة مفيد",
    helpfulUnmark: "إزالة التصويت",
    report: "إبلاغ",
    reportSent: "تم إرسال البلاغ. شكرا.",
    success: "تم الحفظ.",
    error: "حدث خطأ.",
    signInRequired: "سجّلي الدخول للمساهمة.",
    ratingLabel: "متوسط التقييم",
  },
};

export function getTripEngagementTranslations(locale: Locale): TripEngagementTranslations {
  return translations[locale] ?? translations.fr;
}
