// Policy versions v1 — BROUILLONS non publiés, validation juridique qualifiée requise par langue.
const V = (id: string, documentId: string, title: string, content: string) => ({
  id, documentId, version: 1, title, content, published: false, reviewedBy: null, reviewedAt: null, publishedAt: null,
});
const PROV = "PROVISOIRE — validation juridique qualifiée requise avant publication. ";
export default [
  V("polver-booking-fr", "poldoc-booking-fr", "Conditions de réservation (provisoire)", `${PROV}La réservation est confirmée après acceptation de la candidature et réception du paiement. Le solde est dû avant la date indiquée au devis.`),
  V("polver-booking-en", "poldoc-booking-en", "Booking terms (provisional)", `${PROV}Booking is confirmed after application approval and payment receipt. Balance is due before the quoted date.`),
  V("polver-booking-es", "poldoc-booking-es", "Condiciones de reserva (provisional)", `${PROV}La reserva se confirma tras la aceptación y el pago. El saldo vence antes de la fecha indicada.`),
  V("polver-booking-ar", "poldoc-booking-ar", "شروط الحجز (مؤقت)", `${PROV}يتأكد الحجز بعد القبول والدفع. الرصيد مستحق قبل التاريخ المذكور.`),
  V("polver-cancel-fr", "poldoc-cancel-fr", "Annulation (provisoire)", `${PROV}Annulation gratuite jusqu'à 45 jours avant le départ, 50 % entre 45 et 15 jours, aucun remboursement sous 15 jours.`),
  V("polver-cancel-en", "poldoc-cancel-en", "Cancellation (provisional)", `${PROV}Free cancellation until 45 days before departure, 50 % between 45 and 15 days, no refund under 15 days.`),
  V("polver-cancel-es", "poldoc-cancel-es", "Cancelación (provisional)", `${PROV}Cancelación gratuita hasta 45 días antes, 50 % entre 45 y 15 días, sin reembolso bajo 15 días.`),
  V("polver-cancel-ar", "poldoc-cancel-ar", "الإلغاء (مؤقت)", `${PROV}إلغاء مجاني حتى 45 يوما قبل المغادرة، 50 % بين 45 و15 يوما، لا استرداد تحت 15 يوما.`),
];
