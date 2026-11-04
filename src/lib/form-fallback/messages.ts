import { LOCALES, type Locale } from "@/i18n/config";

export interface FlashMessages {
  success: string;
  invalid: string;
  unauthorized: string;
  forbidden: string;
  rateLimited: string;
  tooLarge: string;
  generic: string;
}

const MESSAGES: Record<Locale, FlashMessages> = {
  fr: {
    success: "Enregistré.",
    invalid: "Certains champs sont invalides. Vérifiez votre saisie et réessayez.",
    unauthorized: "Veuillez vous connecter pour continuer.",
    forbidden: "Vous n'avez pas l'autorisation d'effectuer cette action.",
    rateLimited: "Trop de tentatives. Réessayez dans quelques instants.",
    tooLarge: "Les données envoyées sont trop volumineuses.",
    generic: "L'action a échoué. Réessayez plus tard.",
  },
  en: {
    success: "Saved.",
    invalid: "Some fields are invalid. Check your input and try again.",
    unauthorized: "Please sign in to continue.",
    forbidden: "You are not allowed to perform this action.",
    rateLimited: "Too many attempts. Please try again shortly.",
    tooLarge: "The submitted data is too large.",
    generic: "The action failed. Please try again later.",
  },
  es: {
    success: "Guardado.",
    invalid: "Algunos campos no son válidos. Revisa los datos e inténtalo de nuevo.",
    unauthorized: "Inicia sesión para continuar.",
    forbidden: "No tienes permiso para realizar esta acción.",
    rateLimited: "Demasiados intentos. Inténtalo de nuevo en unos instantes.",
    tooLarge: "Los datos enviados son demasiado grandes.",
    generic: "La acción ha fallado. Inténtalo de nuevo más tarde.",
  },
  ar: {
    success: "تم الحفظ.",
    invalid: "بعض الحقول غير صالحة. راجع البيانات وأعد المحاولة.",
    unauthorized: "يرجى تسجيل الدخول للمتابعة.",
    forbidden: "ليس لديك إذن لتنفيذ هذا الإجراء.",
    rateLimited: "محاولات كثيرة. أعد المحاولة بعد قليل.",
    tooLarge: "حجم البيانات المرسلة كبير جدًا.",
    generic: "فشل الإجراء. أعد المحاولة لاحقًا.",
  },
};

export function localeFromPathname(pathname: string): Locale {
  const first = pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  return (LOCALES as readonly string[]).includes(first ?? "") ? (first as Locale) : "en";
}

export function flashMessages(locale: Locale): FlashMessages {
  return MESSAGES[locale];
}
