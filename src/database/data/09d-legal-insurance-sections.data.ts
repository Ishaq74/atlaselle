// Sections de la page légale « assurance voyage », dans les 4 locales.
//
// Même situation que 09c-legal-terms-sections.data.ts : la page existait sans
// contenu d'onglet. Schéma identique ({ title, intro?, items: [...] }) et
// identifiants de page issus de 09-legal-pages.data.ts.

const INSURANCE_FR = 'cde2a2af-719a-4a5f-8532-cfcfbd354693';
const INSURANCE_EN = '78fbccb0-e17b-4ec7-ab89-45388e3ed184';
const INSURANCE_ES = '9e555f9d-d084-4d04-8ddc-ce292ed954e5';
const INSURANCE_AR = '1c3f8ce8-306e-480e-bf2b-b6d0e17e586c';

export default [
  // ══════════════════════════════════════════════════════════════════════
  // FR — Assurance voyage
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'b2e1d3a5-2222-4b2b-8d22-0000000000fr',
    pageId: INSURANCE_FR,
    type: 'faq',
    sortOrder: 0,
    isVisible: true,
    content: {
      title: 'Assurance voyage — obligation et justificatif',
      intro:
        "Toute voyageuse et tout voyageur participant à un départ {{siteName}} doit être couvert par une assurance voyage couvrant le rapatriement et les frais médicaux. [Document à faire valider par un juriste avant mise en production.]",
      items: [
        { question: 'Pourquoi l’assurance voyage est-elle obligatoire ?', answer: "Sans assurance, un incident médical à l'étranger peut coûter plusieurs dizaines de milliers d'euros, souvent pris en charge uniquement par l'assurance. L'obligation protège le voyageur ; elle est mentionnée dans les conditions de réservation." },
        { question: 'Que doit couvrir mon assurance ?', answer: 'Au minimum : rapatriement sanitaire, frais médicaux et chirurgicaux, prise en charge lors d’un déplacement en ambulance, et annulation ou interruption de voyage. Une couverture bagage est recommandée.' },
        { question: 'Quand et comment transmettre mon attestation ?', answer: 'Vous devez transmettre votre attestation au plus tard 15 jours avant le départ, à l’adresse {{email}}. Elle doit mentionner la destination, les dates du voyage et la garantie rapatriement.' },
        { question: 'Une assurance annuelle est-elle acceptée ?', answer: "Oui, à condition que la police en cours couvre la destination et toute la durée du voyage, y compris la période de retour. Vérifiez les exclusions géographiques auprès de votre assureur." },
        { question: 'Que se passe-t-il si j’arrive sans attestation ?', answer: "Si l'attestation n'a pas été reçue 48 heures avant le départ, le voyageur peut se voir refuser l'embarquement. Ce contrôle est nécessaire pour que la couverture soit opposable sur le terrain." },
        { question: 'Puis-jearantine annuler le voyage à cause de l’assurance ?', answer: "Les frais d'annulation liés à un refus de prise en charge ne sont pas remboursés. Une assurance couvrant l'annulation pour refus de visa est recommandée séparément." },
      ],
    },
  },
  {
    id: 'b2e1d3a5-2222-4b2b-8d22-0000000001fr',
    pageId: INSURANCE_FR,
    type: 'faq',
    sortOrder: 1,
    isVisible: true,
    content: {
      title: 'Numéros utiles pendant le voyage',
      intro: 'Ces numéros vous sont remis sur la fiche du départ et sont disponibles 24 h/24.',
      items: [
        { question: 'Assistance 24 h/24', answer: 'Le numéro d’assistance est indiqué sur votre fiche de départ. Il reste joignable pendant toute la durée du voyage, y compris le transfert et le retour.' },
        { question: 'Contact de {{siteName}}', answer: 'Écrivez à {{email}}. En cas d’urgence, indiquez votre numéro de réservation et votre position.' },
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════════════
  // EN — Travel insurance
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'b2e1d3a5-2222-4b2b-8d22-0000000000en',
    pageId: INSURANCE_EN,
    type: 'faq',
    sortOrder: 0,
    isVisible: true,
    content: {
      title: 'Travel insurance — requirement and proof',
      intro:
        'Every traveller joining a {{siteName}} departure must be covered by travel insurance including repatriation and medical costs. [Document to be reviewed by a lawyer before going live.]',
      items: [
        { question: 'Why is travel insurance mandatory?', answer: 'Without insurance, a medical emergency abroad can cost tens of thousands of euros, often payable only through insurance. The requirement protects the traveller and is referenced in the booking terms.' },
        { question: 'What must my policy cover?', answer: 'At minimum: medical repatriation, medical and surgical costs, emergency transport, and trip cancellation or interruption. Baggage cover is recommended.' },
        { question: 'When and how do I send my certificate?', answer: 'Send your certificate to {{email}} at the latest 15 days before departure. It must state the destination, the travel dates and the repatriation cover.' },
        { question: 'Is annual insurance accepted?', answer: 'Yes, provided the active policy covers the destination and the whole trip duration, including the return. Check geographic exclusions with your insurer.' },
        { question: 'What if I arrive without a certificate?', answer: 'If no certificate has been received 48 hours before departure, the traveller may be refused boarding. This check ensures the cover is enforceable on the ground.' },
        { question: 'Can I cancel because of insurance?', answer: 'Costs arising from a refusal of cover are not refundable. Separate cancellation-for-refusal-of-visa cover is recommended.' },
      ],
    },
  },
  {
    id: 'b2e1d3a5-2222-4b2b-8d22-0000000001en',
    pageId: INSURANCE_EN,
    type: 'faq',
    sortOrder: 1,
    isVisible: true,
    content: {
      title: 'Useful numbers during the trip',
      intro: 'These numbers are printed on your trip sheet and are available 24/7.',
      items: [
        { question: '24/7 assistance', answer: 'The assistance number is printed on your trip sheet and remains reachable for the whole trip, including transfers and the return.' },
        { question: 'Contacting {{siteName}}', answer: 'Email {{email}}. In an emergency, include your booking reference and your location.' },
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════════════
  // ES — Seguro de viaje
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'b2e1d3a5-2222-4b2b-8d22-0000000000es',
    pageId: INSURANCE_ES,
    type: 'faq',
    sortOrder: 0,
    isVisible: true,
    content: {
      title: 'Seguro de viaje — obligación y justificante',
      intro: 'Toda persona viajera que participe en una salida de {{siteName}} debe estar cubierta por un seguro de viaje que incluya el repatriamiento y los gastos médicos. [Documento pendiente de revisión jurídica antes de publicarlo.]',
      items: [
        { question: '¿Por qué es obligatorio el seguro de viaje?', answer: 'Sin seguro, una emergencia médica en el extranjero puede costar decenas de miles de euros, y a menudo solo los cubre el seguro. La obligación protege al viajero y figura en las condiciones de reserva.' },
        { question: '¿Qué debe cubrir mi póliza?', answer: 'Como mínimo: repatriación sanitaria, gastos médicos y quirúrgicos, traslado en ambulancia y cancelación o interrupción del viaje. Se recomienda incluir el equipaje.' },
        { question: '¿Cuándo y cómo envío el justificante?', answer: 'Envía el justificante a {{email}} a más tardar 15 días antes de la salida. Debe indicar el destino, las fechas del viaje y la garantía de repatriamiento.' },
        { question: '¿Se acepta un seguro anual?', answer: 'Sí, siempre que la póliza vigente cubra el destino y toda la duración del viaje, incluido el regreso. Comprueba las exclusiones geográficas con tu aseguradora.' },
        { question: '¿Qué pasa si llego sin justificante?', answer: 'Si no se ha recibido el justificante 48 horas antes de la salida, se puede denegar el embarque. Este control garantiza que la cobertura sea exigible sobre el terreno.' },
        { question: '¿Puedo cancelar por el seguro?', answer: 'Los costes derivados de una denegación de cobertura no se reembolsan. Se recomienda contratar aparte la cancelación por denegación de visado.' },
      ],
    },
  },
  {
    id: 'b2e1d3a5-2222-4b2b-8d22-0000000001es',
    pageId: INSURANCE_ES,
    type: 'faq',
    sortOrder: 1,
    isVisible: true,
    content: {
      title: 'Números útiles durante el viaje',
      intro: 'Estos números aparecen en la ficha del viaje y están disponibles 24/7.',
      items: [
        { question: 'Asistencia 24/7', answer: 'El número de asistencia figura en la ficha del viaje y sigue disponible durante todo el viaje, incluidos los traslados y el regreso.' },
        { question: 'Contactar con {{siteName}}', answer: 'Escribe a {{email}}. En caso de urgencia, indica tu número de reserva y tu ubicación.' },
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════════════
  // AR — تأمين السفر
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'b2e1d3a5-2222-4b2b-8d22-0000000000ar',
    pageId: INSURANCE_AR,
    type: 'faq',
    sortOrder: 0,
    isVisible: true,
    content: {
      title: 'تأمين السفر — الشرط والإثبات',
      intro: 'كل مسافر يشارك في مغادرة {{siteName}} يجب أن يكون مغطى بتأمين سفر يشمل العودة والتكاليف الطبية. [يُراجع قانونيًا قبل النشر.]',
      items: [
        { question: 'لماذا تأمين السفر إلزامي؟', answer: 'بدون تأمين، قد تكلّف الحالة الطبية في الخارج عشرات الآلاف من اليوروهات، وكثيرًا ما لا يغطيها إلا التأمين. الشرط يحمي المسافر وهو مذكور في شروط الحجز.' },
        { question: 'ما الذي يجب أن تغطيه وثيقي؟', answer: 'على الأقل: العودة الطبية، والمصاريف الطبية والجراحية، والنقل بالسيارة إسعاف، وإلغاء الرحلة أو قطعها. ويُنصح بتغطية الأمتعة.' },
        { question: 'متى وكيف أرسل شهادة التأمين؟', answer: 'أرسلي الشهادة إلى {{email}} في موعد أقصاه 15 يومًا قبل المغادرة. يجب أن تذكر الوجهة وتواريخ الرحلة وضمان العودة.' },
        { question: 'هل يُقبل التأمين السنوي؟', answer: 'نعم، بشرط أن تغطّي الوثيقة السارية الوجهة وكامل مدة الرحلة بما في ذلك العودة. تحققي من الاستثناءات الجغرافية لدى شركة التأمين.' },
        { question: 'ماذا لو وصلت دون شهادة؟', answer: 'إذا لم تصل الشهادة قبل 48 ساعة من المغادرة، قد يُرفض صعود الطائرة. يضمن هذا التحقق أن التغطية سارية على أرض الواقع.' },
        { question: 'هل يمكنني الإلغاء بسبب التأمين؟', answer: 'لا تُسترد التكاليف الناتجة عن رفض التغطية. يُنصح بشراء تأمين إلغاء الرحلة بشكل منفصل.' },
      ],
    },
  },
  {
    id: 'b2e1d3a5-2222-4b2b-8d22-0000000001ar',
    pageId: INSURANCE_AR,
    type: 'faq',
    sortOrder: 1,
    isVisible: true,
    content: {
      title: 'أرقام مفيدة أثناء الرحلة',
      intro: 'تظهر هذه الأرقام في بطاقة الرحلة وهي متاحة على مدار الساعة.',
      items: [
        { question: 'الدعم على مدار الساعة', answer: 'رقم الدعم مطبوع في بطاقة الرحلة ويبقى متاحًا طوال مدة الرحلة، بما في ذلك عمليات النقل والعودة.' },
        { question: 'التواصل مع {{siteName}}', answer: 'اكتبي إلى {{email}}. في الحالات العاجلة، اذكري رقم الحجز وموقعك.' },
      ],
    },
  },
];
