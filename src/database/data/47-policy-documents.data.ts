// Policy documents — booking_terms + cancellation × 4 locales (contenu PROVISOIRE, validation juridique requise, TODO §13.7).
const D = (id: string, type: "booking_terms" | "cancellation", locale: "fr" | "en" | "es" | "ar") => ({ id, type, locale });
export default [
  D("c35a9b60-6af8-4bb7-aa1b-c3e7ae8f174d", "booking_terms", "fr"),
  D("3e8fac3d-aa91-4abc-a9a0-f60e87e78204", "booking_terms", "en"),
  D("9d37ac17-98fc-435a-a280-78061d95ff98", "booking_terms", "es"),
  D("77f9e9ab-bd0a-4e04-a1eb-b0f5c3397500", "booking_terms", "ar"),
  D("6a7045c2-fbcf-42c0-ab7b-db716b3efa0d", "cancellation", "fr"),
  D("1c0d77ea-c22d-43ad-a976-85e30abf047c", "cancellation", "en"),
  D("479c91d9-8747-450b-aac9-b8f926582512", "cancellation", "es"),
  D("f05ff267-0626-4051-a66f-4c0b94fe19d8", "cancellation", "ar"),
];
