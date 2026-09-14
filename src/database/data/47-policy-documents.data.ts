// Policy documents — booking_terms + cancellation × 4 locales (contenu PROVISOIRE, validation juridique requise, TODO §13.7).
const D = (id: string, type: "booking_terms" | "cancellation", locale: "fr" | "en" | "es" | "ar") => ({ id, type, locale });
export default [
  D("poldoc-booking-fr", "booking_terms", "fr"),
  D("poldoc-booking-en", "booking_terms", "en"),
  D("poldoc-booking-es", "booking_terms", "es"),
  D("poldoc-booking-ar", "booking_terms", "ar"),
  D("poldoc-cancel-fr", "cancellation", "fr"),
  D("poldoc-cancel-en", "cancellation", "en"),
  D("poldoc-cancel-es", "cancellation", "es"),
  D("poldoc-cancel-ar", "cancellation", "ar"),
];
