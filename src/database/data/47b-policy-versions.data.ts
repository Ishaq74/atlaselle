// Policy versions v1 — BROUILLONS non publiés, validation juridique qualifiée requise par langue.
const V = (id: string, documentId: string, title: string, content: string) => ({
  id, documentId, version: 1, title, content, published: false, reviewedBy: null, reviewedAt: null, publishedAt: null,
});
const PROV = "PROVISOIRE — validation juridique qualifiée requise avant publication. ";
export default [
  V("93ffc328-4d97-4a49-adf8-ab7b4f8f210a", "c35a9b60-6af8-4bb7-aa1b-c3e7ae8f174d", "Conditions de réservation (provisoire)", `${PROV}La réservation est confirmée après acceptation de la candidature et réception du paiement. Le solde est dû avant la date indiquée au devis.`),
  V("9d2a3bc7-1740-4807-a6fd-8ac8e5fcc634", "3e8fac3d-aa91-4abc-a9a0-f60e87e78204", "Booking terms (provisional)", `${PROV}Booking is confirmed after application approval and payment receipt. Balance is due before the quoted date.`),
  V("785d6687-547c-4f1f-a766-e4fa090f625b", "9d37ac17-98fc-435a-a280-78061d95ff98", "Condiciones de reserva (provisional)", `${PROV}La reserva se confirma tras la aceptación y el pago. El saldo vence antes de la fecha indicada.`),
  V("4e7591a3-b23b-4ff3-a707-34a5b5193f42", "77f9e9ab-bd0a-4e04-a1eb-b0f5c3397500", "شروط الحجز (مؤقت)", `${PROV}يتأكد الحجز بعد القبول والدفع. الرصيد مستحق قبل التاريخ المذكور.`),
  V("f35788ce-1402-47bf-a38a-1dd20451dd6e", "6a7045c2-fbcf-42c0-ab7b-db716b3efa0d", "Annulation (provisoire)", `${PROV}Annulation gratuite jusqu'à 45 jours avant le départ, 50 % entre 45 et 15 jours, aucun remboursement sous 15 jours.`),
  V("03ca579d-d8ff-42cc-ac60-f9effd1d51a9", "1c0d77ea-c22d-43ad-a976-85e30abf047c", "Cancellation (provisional)", `${PROV}Free cancellation until 45 days before departure, 50 % between 45 and 15 days, no refund under 15 days.`),
  V("f0fbf2aa-dc5d-450b-ad75-dae840a44932", "479c91d9-8747-450b-aac9-b8f926582512", "Cancelación (provisional)", `${PROV}Cancelación gratuita hasta 45 días antes, 50 % entre 45 y 15 días, sin reembolso bajo 15 días.`),
  V("d66f950e-8b08-4b95-a3d0-4c7f0adc2a36", "f05ff267-0626-4051-a66f-4c0b94fe19d8", "الإلغاء (مؤقت)", `${PROV}إلغاء مجاني حتى 45 يوما قبل المغادرة، 50 % بين 45 و15 يوما، لا استرداد تحت 15 يوما.`),
];
