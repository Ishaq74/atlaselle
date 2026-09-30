// Sections des pages légales « conditions de réservation » et « assurance voyage ».
//
// Ces deux pages ont été ajoutées après les pages de mentions légales
// (09-legal-pages.data.ts) mais SANS leurs sections : leurs onglets
// s'affichaient donc vides. Le contenu ci-dessous comble ce manque, avec le
// même schéma que les pages existantes :
//
//   { title, intro?, items: [{ question, answer }] }
//
// Le texte est volontairement générique et paramétré ({{siteName}},
// {{email}}…) comme le reste : il sert de base de travail legally reviewable
// dans Admin → Pages, pas de texte définitif. Les mentions à faire valider par
// un juriste sont signalées en clair dans les réponses.
//
// Les identifiants de page sont ceux de 09-legal-pages.data.ts.

const TERMS_FR = '785db5e4-f3e3-43cd-b5ad-e26c1aa24600';
const TERMS_EN = 'db88be5b-6aaf-4f65-9859-ffa34999bfaf';
const TERMS_ES = 'a7eaf8f6-94f9-4128-9fb1-e412a8fe74ae';
const TERMS_AR = '2aca68a3-b34e-49b9-9665-95e3c871d4af';

export default [
  // ══════════════════════════════════════════════════════════════════════
  // FR — Conditions de réservation
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'a1f0c2d4-1111-4a1a-9c11-0000000000fr',
    pageId: TERMS_FR,
    type: 'faq',
    sortOrder: 0,
    isVisible: true,
    content: {
      title: 'Conditions de réservation',
      intro:
        "Ces conditions régissent la réservation d'un voyage {{siteName}}. Votre réservation est définitive uniquement après acceptation de votre candidature et réception de l'acompte. [Document à faire valider par un juriste avant mise en production.]",
      items: [
        { question: 'Comment se déroule une réservation ?', answer: "Vous soumettez une candidature pour un départ. {{siteName}} l'étudie et vous répond sous 7 jours ouvrés. Votre place n'est réservée qu'après acceptation de votre candidature et versement de l'acompte indiqué sur la facture." },
        { question: "Quel est le montant de l'acompte ?", answer: "L'acompte représente 30 % du prix total du voyage, sauf mention contraire sur la fiche du départ. Il est dû à la signature du contrat de voyage et n'est pas remboursable au titre de la clause d'annulation du voyageur." },
        { question: 'Puis-je modifier ma réservation ?', answer: 'Toute modification de dates, de voyage ou de voyageur doit être demandée par écrit à {{email}} et reste soumise à disponibilité. Des frais de gestion de 45 € peuvent être appliqués à la demande du voyageur.' },
        { question: 'Quand le solde est-il dû ?', answer: 'Le solde est dû 30 jours avant le départ. Un lien de paiement sécurisé vous est envoyé par e-mail. Aucun départ n’est confirmé sans solde réglé.' },
        { question: 'Puis-je annuler ?', answer: "Toute annulation doit être notifiée par écrit à {{email}}. Les pénalités sont calculées selon l'échéance : plus de 60 jours avant le départ, 70 % de l'acompte sont remboursés ; entre 60 et 30 jours, 50 % ; entre 30 et 15 jours, 25 % ; à moins de 15 jours ou en cas de non-présentation, l'acompte n'est pas remboursé." },
        { question: 'Un remboursement est-il possible en cas d’annulation par l’organisation ?', answer: "Si {{siteName}} annule un départ, l'acompte et le solde sont intégralement remboursés sous 15 jours ouvrés. Un voyage de remplacement est proposé en priorité." },
        { question: 'Quels moyens de paiement sont acceptés ?', answer: "Carte bancaire (Visa, Mastercard, American Express) et virement bancaire. Les paiements sont traités de façon sécurisée par notre prestataire de paiement ; {{siteName}} ne stocke jamais votre numéro de carte." },
        { question: 'Qui est mon interlocuteur en cas de question ?', answer: "Pour toute question relative à votre réservation, écrivez à {{email}}. L'équipe répond sous 2 jours ouvrés." },
      ],
    },
  },
  {
    id: 'a1f0c2d4-1111-4a1a-9c11-0000000001fr',
    pageId: TERMS_FR,
    type: 'faq',
    sortOrder: 1,
    isVisible: true,
    content: {
      title: 'Formalités et documents',
      intro: 'Certaines formalités dépendent de votre nationalité et de votre destination. Vérifiez-les avant de réserver.',
      items: [
        { question: 'Une passeport est-il nécessaire ?', answer: "Un passeport valide au-delà de 3 mois après la date de retour est exigé pour toutes les destinations. Le nom doit être identique à celui de votre billet d'avion." },
        { question: 'Un visa est-il nécessaire ?', answer: "Selon votre nationalité et la destination, un visa ou une autorisation de voyage peut être exigé. La responsabilité de l'obtenir et de le présenter à l'arrivée vous incombe ; {{siteName}} ne peut être tenue responsable d'un refus d'embarquement." },
        { question: 'Faut-il un carnet de vaccination ?', answer: "Selon la destination, certains vaccins peuvent être exigés, notamment la fièvre jaune. Consultez un médecin au moins 6 semaines avant votre départ." },
      ],
    },
  },
  {
    id: 'a1f0c2d4-1111-4a1a-9c11-0000000002fr',
    pageId: TERMS_FR,
    type: 'faq',
    sortOrder: 2,
    isVisible: true,
    content: {
      title: 'Responsabilités du voyageur',
      items: [
        { question: "L'assurance voyage est-elle obligatoire ?", answer: "Oui. Une assurance voyage couvrant le rapatriement et les frais médicaux est obligatoire pour tout voyage {{siteName}}. Consultez la page « Assurance voyage »." },
        { question: 'Que se passe-t-il en cas de problème pendant le voyage ?', answer: "Pendant le voyage, la responsabilité de l'organisateur est régie par les dispositions du code des transports. Pour toute situation nécessitant une assistance immédiate, contactez l'assistance 24 h/24 et 7 j/7 dont le numéro vous est remis avant le départ." },
        { question: 'Puis-je interrompre mon voyage ?', answer: "Un départ déjà engagé ne peut être interrompu à la demande du voyageur. Toute demande de retour anticipé est traitée au cas par cas et peut entraîner des frais." },
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════════════
  // EN — Booking terms
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'a1f0c2d4-1111-4a1a-9c11-0000000000en',
    pageId: TERMS_EN,
    type: 'faq',
    sortOrder: 0,
    isVisible: true,
    content: {
      title: 'Booking terms',
      intro:
        'These terms govern the booking of a {{siteName}} trip. Your booking is final only once your application is accepted and the deposit is received. [Document to be reviewed by a lawyer before going live.]',
      items: [
        { question: 'How does booking work?', answer: 'You apply for a departure. {{siteName}} reviews your application and replies within 7 business days. Your place is confirmed only after your application is accepted and the deposit shown on the invoice is paid.' },
        { question: 'How much is the deposit?', answer: 'The deposit is 30% of the total trip price, unless stated otherwise on the departure page. It is due when the travel contract is signed and is not refundable under the traveller cancellation clause.' },
        { question: 'Can I change my booking?', answer: 'Any change of dates, trip or traveller must be requested in writing to {{email}} and remains subject to availability. An administration fee of 45 € may apply at the traveller request.' },
        { question: 'When is the balance due?', answer: 'The balance is due 30 days before departure. A secure payment link is emailed to you. No departure is confirmed until the balance is settled.' },
        { question: 'Can I cancel?', answer: 'Any cancellation must be notified in writing to {{email}}. Penalties depend on the date: more than 60 days before departure, 70% of the deposit is refunded; 60 to 30 days, 50%; 30 to 15 days, 25%; less than 15 days or no-show, the deposit is not refunded.' },
        { question: 'What if the organiser cancels?', answer: 'If {{siteName}} cancels a departure, the deposit and balance are refunded in full within 15 business days. A replacement departure is offered first.' },
        { question: 'Which payment methods are accepted?', answer: 'Credit card (Visa, Mastercard, American Express) and bank transfer. Payments are handled securely by our payment provider; {{siteName}} never stores your card number.' },
        { question: 'Who do I contact with questions?', answer: 'For anything related to your booking, email {{email}}. The team replies within 2 business days.' },
      ],
    },
  },
  {
    id: 'a1f0c2d4-1111-4a1a-9c11-0000000001en',
    pageId: TERMS_EN,
    type: 'faq',
    sortOrder: 1,
    isVisible: true,
    content: {
      title: 'Documents and formalities',
      intro: 'Requirements depend on your nationality and destination. Check them before booking.',
      items: [
        { question: 'Do I need a passport?', answer: 'A passport valid beyond 3 months after your return date is required for all destinations. The name must match your flight ticket exactly.' },
        { question: 'Do I need a visa?', answer: 'Depending on your nationality and destination, a visa or travel authorisation may be required. Obtaining it and presenting it on arrival is your responsibility; {{siteName}} cannot be held liable for a denied boarding.' },
        { question: 'Are vaccinations required?', answer: 'Some destinations require certain vaccines, including yellow fever. See a doctor at least 6 weeks before departure.' },
      ],
    },
  },
  {
    id: 'a1f0c2d4-1111-4a1a-9c11-0000000002en',
    pageId: TERMS_EN,
    type: 'faq',
    sortOrder: 2,
    isVisible: true,
    content: {
      title: 'Traveller responsibilities',
      items: [
        { question: 'Is travel insurance mandatory?', answer: 'Yes. Travel insurance covering repatriation and medical costs is mandatory for every {{siteName}} trip. See the "Travel Insurance" page.' },
        { question: 'What if something happens during the trip?', answer: 'During the trip, the organiser’s liability is governed by the applicable transport law provisions. For anything needing immediate assistance, call the 24/7 support line provided before departure.' },
        { question: 'Can I cut my trip short?', answer: 'A departure already underway cannot be interrupted at the traveller request. Early return requests are considered case by case and may incur costs.' },
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════════════
  // ES — Condiciones de reserva
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'a1f0c2d4-1111-4a1a-9c11-0000000000es',
    pageId: TERMS_ES,
    type: 'faq',
    sortOrder: 0,
    isVisible: true,
    content: {
      title: 'Condiciones de reserva',
      intro: 'Estas condiciones regulan la reserva de un viaje de {{siteName}}. La reserva es firme solo tras la aceptación de tu candidatura y la recepción del depósito. [Documento pendiente de revisión jurídica antes de publicarlo.]',
      items: [
        { question: '¿Cómo se realiza una reserva?', answer: 'Envías una candidatura para una salida. {{siteName}} la estudia y responde en 7 días hábiles. Tu plaza queda confirmada solo tras aceptar la candidatura y abonar el depósito indicado en la factura.' },
        { question: '¿De cuánto es el depósito?', answer: 'El depósito es del 30% del precio total del viaje, salvo que la ficha de la salida indique otra cosa. Se abona al firmar el contrato de viaje y no es reembolsable por la cláusula de cancelación del viajero.' },
        { question: '¿Puedo modificar mi reserva?', answer: 'Cualquier cambio de fechas, viaje o viajero debe solicitarse por escrito a {{email}} y queda sujeto a disponibilidad. Puede aplicarse un gasto de gestión de 45 €.' },
        { question: '¿Cuándo se paga el saldo?', answer: 'El saldo se paga 30 días antes de la salida. Recibirás por correo un enlace de pago seguro. Ninguna salida se confirma sin el saldo abonado.' },
        { question: '¿Puedo cancelar?', answer: 'La cancelación debe notificarse por escrito a {{email}}. Las penalizaciones dependen del plazo: con más de 60 días de antelación se devuelve el 70% del depósito; entre 60 y 30 días, el 50%; entre 30 y 15 días, el 25%; con menos de 15 días o sin presentarse, el depósito no se devuelve.' },
        { question: '¿Y si cancela la organización?', answer: 'Si {{siteName}} cancela una salida, el depósito y el saldo se devuelven íntegramente en 15 días hábiles. Se propone primero un viaje de reemplazo.' },
        { question: '¿Qué métodos de pago se aceptan?', answer: 'Tarjeta de crédito (Visa, Mastercard, American Express) y transferencia bancaria. Los pagos los gestiona de forma segura nuestro proveedor; {{siteName}} nunca almacena tu número de tarjeta.' },
        { question: '¿A quién escribo si tengo dudas?', answer: 'Para cualquier cuestión sobre tu reserva, escribe a {{email}}. El equipo responde en 2 días hábiles.' },
      ],
    },
  },
  {
    id: 'a1f0c2d4-1111-4a1a-9c11-0000000001es',
    pageId: TERMS_ES,
    type: 'faq',
    sortOrder: 1,
    isVisible: true,
    content: {
      title: 'Documentos y trámites',
      intro: 'Los requisitos dependen de tu nacionalidad y del destino. Verifícalos antes de reservar.',
      items: [
        { question: '¿Hace falta pasaporte?', answer: 'Se exige un pasaporte válido más de 3 meses después de la fecha de regreso para todos los destinos. El nombre debe coincidir exactamente con el del billete de avión.' },
        { question: '¿Hace falta visado?', answer: 'Según tu nacionalidad y el destino puede requerirse visado o autorización de viaje. Obtenerlo y presentarlo al llegar es responsabilidad tuya; {{siteName}} no responde por una denegación de embarque.' },
        { question: '¿Hay vacunas obligatorias?', answer: 'Algunos destinos exigen determinadas vacunas, entre ellas la fiebre amarilla. Consulta a un médico al menos 6 semanas antes de la salida.' },
      ],
    },
  },
  {
    id: 'a1f0c2d4-1111-4a1a-9c11-0000000002es',
    pageId: TERMS_ES,
    type: 'faq',
    sortOrder: 2,
    isVisible: true,
    content: {
      title: 'Responsabilidades del viajero',
      items: [
        { question: '¿El seguro es obligatorio?', answer: 'Sí. Un seguro de viaje que cubra el repatriamiento y los gastos médicos es obligatorio en todos los viajes de {{siteName}}. Consulta la página "Seguro de viaje".' },
        { question: '¿Qué pasa si ocurre un problema durante el viaje?', answer: 'Durante el viaje, la responsabilidad del organizador se rige por las disposiciones del código de transportes. Para asistencia inmediata, llama al 24/7 que recibes antes de salir.' },
        { question: '¿Puedo interrumpir el viaje?', answer: 'Un viaje ya iniciado no puede interrumpirse a petición del viajero. Las solicitudes de regreso anticipado se estudian caso por caso y pueden generar costes.' },
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════════════
  // AR — شروط الحجز
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'a1f0c2d4-1111-4a1a-9c11-0000000000ar',
    pageId: TERMS_AR,
    type: 'faq',
    sortOrder: 0,
    isVisible: true,
    content: {
      title: 'شروط الحجز',
      intro: 'تحكم هذه الشروط حجز رحلة {{siteName}}. لا يصبح الحجز نهائيًا إلا بعد قبول طلبك واستلام الدفعة المقدمة. [يُراجع قانونيًا قبل النشر.]',
      items: [
        { question: 'كيف يتم الحجز؟', answer: 'تقدّمين طلبًا لمغادرة محددة. تدرسه {{siteName}} وترد خلال 7 أيام عمل. لا يُحجز مقعدك إلا بعد قبول الطلب ودفع الدفعة المقدمة المذكورة في الفاتورة.' },
        { question: 'كم تبلغ الدفعة المقدمة؟', answer: 'الدفعة المقدمة 30٪ من سعر الرحلة، ما لم يُذكر خلاف ذلك في بطاقة المغادرة. تُدفع عند توقيع عقد السفر ولا تُسترد وفق بند إلغاء المسافر.' },
        { question: 'هل يمكنني تعديل حجزي؟', answer: 'أي تغيير في التواريخ أو الرحلة أو المسافر يجب طلبه كتابةً إلى {{email}} ويخضع للتوفر. قد تُطبَّق رسوم إدارية قدرها 45 يورو.' },
        { question: 'متى يُدفع الرصيد؟', answer: 'يُدفع الرصيد قبل المغادرة بـ30 يومًا. يصلك رابط دفع آمن عبر البريد الإلكتروني. لا تُؤكَّد أي مغادرة قبل سداد الرصيد.' },
        { question: 'هل يمكنني الإلغاء؟', answer: 'يجب إرسال الإلغاء كتابةً إلى {{email}}. تعتمد الغرامات على التوقيت: قبل أكثر من 60 يومًا يُسترد 70٪ من الدفعة المقدمة؛ بين 60 و30 يومًا يُسترد 50٪؛ بين 30 و15 يومًا يُسترد 25٪؛ قبل أقل من 15 يومًا أو في حال عدم الحضور لا يُسترد شيء.' },
        { question: 'ماذا لو ألغت الجهة المنظمة؟', answer: 'إذا ألغت {{siteName}} مغادرة، تُسترد الدفعة المقدمة والرصيد بالكامل خلال 15 يوم عمل. ويُقدَّم بديل أولًا.' },
        { question: 'ما طرق الدفع المقبولة؟', answer: 'بطاقة ائتمان (فيزا وماستركارد وأمريكان إكسبريس) أو تحويل بنكي. تُعالَج المدفوعات بشكل آمن عبر مزوّد الدفع لدينا، ولا تخزّن {{siteName}} رقم بطاقتك أبدًا.' },
        { question: 'من أتصل به في caso وجود استفسار؟', answer: 'لأي استفسار يتعلق بحجزك، اكتبي إلى {{email}}. يرد الفريق خلال يومي عمل.' },
      ],
    },
  },
  {
    id: 'a1f0c2d4-1111-4a1a-9c11-0000000001ar',
    pageId: TERMS_AR,
    type: 'faq',
    sortOrder: 1,
    isVisible: true,
    content: {
      title: 'المستندات والإجراءات',
      intro: 'تختلف المتطلبات حسب جنسيتك ووجهتك. تحققي منها قبل الحجز.',
      items: [
        { question: 'هل أحتاج إلى جواز سفر؟', answer: 'يلزم جواز سفر صالح لأكثر من 3 أشهر بعد تاريخ العودة لجميع الوجهات، ويجب أن يطابق الاسم اسم تذكرة الطيران تمامًا.' },
        { question: 'هل أحتاج إلى تأشيرة؟', answer: 'قد تتطلب جنسيتك أو وجهتك تأشيرة أو تصريح سفر. الحصول عليه وتقديمه عند الوصول مسؤوليتك، ولا تتحمّل {{siteName}} مسؤولية رفض الصعود.' },
        { question: 'هل توجد لقاحات إلزامية؟', answer: 'تطلب بعض الوجهات لقاحات محددة، منها الحمى الصفراء. استشري طبيبًا قبل 6 أسابيع على الأقل من المغادرة.' },
      ],
    },
  },
  {
    id: 'a1f0c2d4-1111-4a1a-9c11-0000000002ar',
    pageId: TERMS_AR,
    type: 'faq',
    sortOrder: 2,
    isVisible: true,
    content: {
      title: 'مسؤوليات المسافر',
      items: [
        { question: 'هل التأمين إلزامي؟', answer: 'نعم. تأمين السفر الذي يغطي العودة والتكاليف الطبية إلزامي في كل رحلات {{siteName}}. راجعي صفحة «تأمين السفر».' },
        { question: 'ماذا يحدث عند حدوث مشكلة أثناء الرحلة؟', answer: 'أثناء الرحلة، تخضع مسؤولية المنظم لأحكام قانون النقل المعمول به. لأي مساعدة عاجلة، اتصلي بخط الدعم على مدار الساعة الذي تستلمينه قبل المغادرة.' },
        { question: 'هل يمكنني قطع الرحلة؟', answer: 'لا يمكن إنهاء رحلة بدأت بالفعل بطلب من المسافر. تُدرَس طلبات العودة المبكرة حالة بحالة وقد يترتب عليها تكاليف.' },
      ],
    },
  },
];
