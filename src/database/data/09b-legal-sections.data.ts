// Legal page sections seed — one FAQ section per tab × locale.
// Each row maps to a pageSections entry whose content is a JSON FaqSection.
//
// Content schema: { title: string; intro?: string; items: { question: string; answer: string; }[] }
//
// Template variables (interpolated at render time from siteSettings + contactInfo):
//   {{siteName}}    — siteSettings.siteName
//   {{email}}       — contactInfo.email
//   {{address}}     — contactInfo.address
//   {{postalCode}}  — contactInfo.postalCode
//   {{city}}        — contactInfo.city
//   {{country}}     — contactInfo.country

const PAGE_FR = 'e71fcecd-c6d4-4da2-96f2-56511c45751d';
const PAGE_EN = 'a0166d52-5135-4490-acef-d2069e6ed8ea';
const PAGE_ES = 'c570003f-2d40-4046-a4d7-c8ef8de9ce33';
const PAGE_AR = '0be07c8a-d987-4b51-ae23-821e408e6e32';
// ── Travel legal pages (fusion 09d) ──
const BOOK_FR = '785db5e4-f3e3-43cd-b5ad-e26c1aa24600';
const BOOK_EN = 'db88be5b-6aaf-4f65-9859-ffa34999bfaf';
const BOOK_ES = 'a7eaf8f6-94f9-4128-9fb1-e412a8fe74ae';
const BOOK_AR = '2aca68a3-b34e-49b9-9665-95e3c871d4af';
const INS_FR = 'cde2a2af-719a-4a5f-8532-cfcfbd354693';
const INS_EN = '78fbccb0-e17b-4ec7-ab89-45388e3ed184';
const INS_ES = '9e555f9d-d084-4d04-8ddc-ce292ed954e5';
const INS_AR = '1c3f8ce8-306e-480e-bf2b-b6d0e17e586c';

export default [
  // ══════════════════════════════════════════════════════════════════════════
  // FR — Mentions Légales
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: '5112d0fd-2074-488d-8768-bb65401bd899',
    pageId: PAGE_FR,
    type: 'faq',
    sortOrder: 0,
    isVisible: true,
    content: {
      title: 'Mentions Légales',
      intro: "Conformément aux dispositions de la loi n° 2004-575 du 21 juin 2004 pour la confiance en l'économie numérique, nous tenons à vous informer de l'identité des différents intervenants impliqués dans la réalisation et le suivi du site {{siteName}}.",
      items: [
        { question: 'Identité du Site', answer: "Le site {{siteName}} est édité par la société {{siteName}}, société par actions simplifiée au capital de 10 000 €, immatriculée au Registre du Commerce et des Sociétés sous le numéro RCS XXXXX, dont le siège social est situé au {{address}}, {{postalCode}} {{city}}, {{country}}." },
        { question: 'Hébergement', answer: 'Le site est hébergé par la société Vercel Inc., située au 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis.' },
        { question: 'Directeur de publication', answer: 'Le Directeur de la publication du site est M./Mme [Nom du directeur de publication].' },
        { question: 'Nous contacter', answer: "Par email : {{email}}\nPar courrier : {{siteName}}, {{address}}, {{postalCode}} {{city}}, {{country}}." },
        { question: 'Données personnelles', answer: 'Le traitement de vos données à caractère personnel est régi par notre Politique de Confidentialité, disponible dans la section « Politique de Confidentialité », conformément au Règlement Général sur la Protection des Données 2016/679 du 27 avril 2016 (« RGPD »).' },
        { question: 'Litiges', answer: "En cas de litige entre le professionnel et le consommateur, ceux-ci s'efforceront de trouver une solution amiable. À défaut d'accord amiable, le consommateur a la possibilité de saisir gratuitement le médiateur de la consommation dont relève le professionnel, dans un délai d'un an à compter de la réclamation écrite adressée au professionnel." },
      ],
    },
  },
  {
    id: 'ef4a4aae-7faa-4e79-8a1b-1ffa0a9286d6',
    pageId: PAGE_FR,
    type: 'faq',
    sortOrder: 1,
    isVisible: true,
    content: {
      title: 'Politique de Confidentialité',
      items: [
        { question: "Informations sur l'entreprise", answer: "L'entreprise {{siteName}}, située au {{address}}, {{postalCode}} {{city}}, {{country}}, est responsable du traitement des données personnelles collectées sur ce site." },
        { question: 'Collecte des données personnelles', answer: "Nous collectons des données personnelles telles que le nom, l'adresse e-mail, l'adresse postale, etc., uniquement dans le cadre de la fourniture de nos services et produits, et avec le consentement explicite de l'utilisateur." },
        { question: 'But de la collecte des données', answer: 'Les données personnelles collectées sont utilisées dans le but de fournir nos services, de traiter les commandes, d\'améliorer notre site et nos produits, et de communiquer avec nos utilisateurs.' },
        { question: 'Consentement', answer: 'En utilisant ce site, vous consentez à la collecte et au traitement de vos données personnelles conformément à notre politique de confidentialité.' },
        { question: 'Utilisation des données', answer: 'Les données personnelles sont utilisées uniquement aux fins spécifiées lors de la collecte et sont protégées conformément aux lois sur la protection des données en vigueur.' },
        { question: 'Partage des données', answer: 'Nous ne partageons pas vos données personnelles avec des tiers, sauf dans les cas prévus par la loi ou avec votre consentement explicite.' },
        { question: 'Droits des utilisateurs', answer: "Vous avez le droit d'accéder à vos données personnelles, de les corriger, de les supprimer et de vous opposer à leur traitement. Pour exercer ces droits, veuillez nous contacter à {{email}}." },
        { question: 'Cookies et suivi en ligne', answer: "Ce site utilise des cookies et d'autres technologies de suivi pour améliorer votre expérience de navigation et pour collecter des informations sur la manière dont vous utilisez le site." },
        { question: 'Mises à jour de la politique de confidentialité', answer: 'Cette politique de confidentialité peut être mise à jour périodiquement pour refléter les changements dans nos pratiques en matière de confidentialité. Toute modification importante sera clairement indiquée sur cette page.' },
      ],
    },
  },
  {
    id: '8d81c45f-dedf-4464-8cce-848fd5093513',
    pageId: PAGE_FR,
    type: 'faq',
    sortOrder: 2,
    isVisible: true,
    content: {
      title: 'Conditions Générales de Vente',
      items: [
        { question: "Champ d'application", answer: "Les présentes Conditions Générales de Vente (CGV) s'appliquent à toutes les commandes passées par le client (ci-après dénommé « le Client ») auprès de {{siteName}} (ci-après dénommé « le Vendeur ») via le site web {{siteName}}." },
        { question: 'Commandes', answer: "Le Client peut passer commande via le site web {{siteName}}. Toute commande implique l'acceptation expresse et sans réserve des présentes CGV." },
        { question: 'Prix', answer: 'Les prix des produits sont indiqués en euros toutes taxes comprises (TTC). Le Vendeur se réserve le droit de modifier ses prix à tout moment, mais les produits seront facturés sur la base des tarifs en vigueur au moment de la validation de la commande.' },
        { question: 'Paiement', answer: "Le paiement s'effectue en ligne par carte bancaire ou tout autre moyen de paiement sécurisé accepté par le Vendeur. La commande ne sera traitée qu'après réception du paiement." },
        { question: 'Livraison', answer: "Les produits seront livrés à l'adresse indiquée par le Client lors de la commande. Les délais de livraison sont donnés à titre indicatif et peuvent varier en fonction du lieu de livraison et de la disponibilité des produits." },
        { question: 'Droit de rétractation', answer: "Conformément à la législation en vigueur, le Client dispose d'un délai de 14 jours pour exercer son droit de rétractation à compter de la réception des produits, sans avoir à justifier de motifs ni à payer de pénalités." },
        { question: 'Garantie', answer: 'Les produits vendus sont soumis à la garantie légale de conformité et à la garantie des vices cachés prévues par la loi. En cas de non-conformité ou de vice caché, le Client peut choisir entre la réparation, le remplacement ou le remboursement du produit.' },
        { question: 'Responsabilité', answer: "Le Vendeur ne saurait être tenu pour responsable des dommages directs ou indirects causés par l'utilisation des produits vendus. La responsabilité du Vendeur est limitée au montant de la commande." },
        { question: 'Litiges', answer: "En cas de litige, une solution amiable sera recherchée en priorité. À défaut d'accord amiable, le litige sera soumis aux tribunaux compétents." },
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // EN — Legal Notice
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'a8399452-4e60-43d2-8a97-92463daa086a',
    pageId: PAGE_EN,
    type: 'faq',
    sortOrder: 0,
    isVisible: true,
    content: {
      title: 'Legal Notice',
      intro: 'In accordance with the provisions of Law No. 2004-575 of June 21, 2004 on confidence in the digital economy, we wish to inform you of the identity of the parties involved in the creation and management of the {{siteName}} website.',
      items: [
        { question: 'Website Identity', answer: "The {{siteName}} website is published by {{siteName}}, a simplified joint-stock company with a capital of €10,000, registered with the Trade and Companies Register under number RCS XXXXX, headquartered at {{address}}, {{postalCode}} {{city}}, {{country}}." },
        { question: 'Hosting', answer: 'The website is hosted by Vercel Inc., located at 340 S Lemon Ave #4133, Walnut, CA 91789, United States.' },
        { question: 'Publication Director', answer: 'The Publication Director of the website is Mr./Mrs. [Name of publication director].' },
        { question: 'Contact Us', answer: "By email: {{email}}\nBy mail: {{siteName}}, {{address}}, {{postalCode}} {{city}}, {{country}}." },
        { question: 'Personal Data', answer: 'The processing of your personal data is governed by our Privacy Policy, available in the "Privacy Policy" section, in accordance with the General Data Protection Regulation 2016/679 of April 27, 2016 ("GDPR").' },
        { question: 'Disputes', answer: 'In the event of a dispute between the professional and the consumer, they will endeavor to find an amicable solution. Failing an amicable agreement, the consumer may refer the matter free of charge to the consumer mediator within one year of the written complaint addressed to the professional.' },
      ],
    },
  },
  {
    id: '0a021aa1-ef2b-4de6-87e4-2db173335a2d',
    pageId: PAGE_EN,
    type: 'faq',
    sortOrder: 1,
    isVisible: true,
    content: {
      title: 'Privacy Policy',
      items: [
        { question: 'Company Information', answer: "{{siteName}}, located at {{address}}, {{postalCode}} {{city}}, {{country}}, is responsible for the processing of personal data collected on this website." },
        { question: 'Collection of Personal Data', answer: 'We collect personal data such as name, email address, postal address, etc., solely for the purpose of providing our services and products, and with the explicit consent of the user.' },
        { question: 'Purpose of Data Collection', answer: 'Personal data collected is used to provide our services, process orders, improve our website and products, and communicate with our users.' },
        { question: 'Consent', answer: 'By using this website, you consent to the collection and processing of your personal data in accordance with our privacy policy.' },
        { question: 'Data Usage', answer: 'Personal data is used solely for the purposes specified at the time of collection and is protected in accordance with applicable data protection laws.' },
        { question: 'Data Sharing', answer: 'We do not share your personal data with third parties, except in cases provided by law or with your explicit consent.' },
        { question: 'User Rights', answer: 'You have the right to access, correct, delete, and object to the processing of your personal data. To exercise these rights, please contact us at {{email}}.' },
        { question: 'Cookies and Online Tracking', answer: 'This website uses cookies and other tracking technologies to improve your browsing experience and to collect information about how you use the site.' },
        { question: 'Privacy Policy Updates', answer: 'This privacy policy may be updated periodically to reflect changes in our privacy practices. Any significant changes will be clearly indicated on this page.' },
      ],
    },
  },
  {
    id: '6bcaa0f0-8ff5-47fa-8531-c91ca8bcabf0',
    pageId: PAGE_EN,
    type: 'faq',
    sortOrder: 2,
    isVisible: true,
    content: {
      title: 'Terms of Sale',
      items: [
        { question: 'Scope of Application', answer: 'These Terms of Sale apply to all orders placed by the customer (hereinafter referred to as "the Customer") from {{siteName}} (hereinafter referred to as "the Seller") via the website {{siteName}}.' },
        { question: 'Orders', answer: 'The Customer may place orders via the website {{siteName}}. Any order implies express and unreserved acceptance of these Terms of Sale.' },
        { question: 'Prices', answer: 'Product prices are indicated in euros including all taxes (TTC). The Seller reserves the right to modify prices at any time, but products will be invoiced at the rates in effect at the time of order validation.' },
        { question: 'Payment', answer: 'Payment is made online by credit card or any other secure payment method accepted by the Seller. The order will only be processed after receipt of payment.' },
        { question: 'Delivery', answer: 'Products will be delivered to the address indicated by the Customer during the order. Delivery times are given as an indication and may vary depending on the delivery location and product availability.' },
        { question: 'Right of Withdrawal', answer: 'In accordance with current legislation, the Customer has 14 days to exercise the right of withdrawal from receipt of the products, without having to justify reasons or pay penalties.' },
        { question: 'Warranty', answer: 'Products sold are subject to the legal guarantee of conformity and the guarantee against hidden defects as provided by law. In the event of non-conformity or hidden defect, the Customer may choose between repair, replacement, or refund.' },
        { question: 'Liability', answer: "The Seller shall not be held liable for direct or indirect damages caused by the use of products sold. The Seller's liability is limited to the amount of the order." },
        { question: 'Disputes', answer: 'In the event of a dispute, an amicable solution will be sought as a priority. Failing an amicable agreement, the dispute will be submitted to the competent courts.' },
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ES — Aviso Legal
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: '1ef4cdcf-fefc-4d47-98a5-31c3c523a9af',
    pageId: PAGE_ES,
    type: 'faq',
    sortOrder: 0,
    isVisible: true,
    content: {
      title: 'Aviso Legal',
      intro: 'De conformidad con las disposiciones de la Ley n° 2004-575 del 21 de junio de 2004 sobre la confianza en la economía digital, le informamos de la identidad de las diferentes partes involucradas en la creación y el seguimiento del sitio {{siteName}}.',
      items: [
        { question: 'Identidad del Sitio', answer: "El sitio {{siteName}} es editado por la empresa {{siteName}}, sociedad por acciones simplificada con un capital de 10.000 €, inscrita en el Registro Mercantil bajo el número RCS XXXXX, con domicilio social en {{address}}, {{postalCode}} {{city}}, {{country}}." },
        { question: 'Alojamiento', answer: 'El sitio está alojado por la empresa Vercel Inc., ubicada en 340 S Lemon Ave #4133, Walnut, CA 91789, Estados Unidos.' },
        { question: 'Director de publicación', answer: 'El Director de publicación del sitio es el Sr./Sra. [Nombre del director de publicación].' },
        { question: 'Contacto', answer: "Por correo electrónico: {{email}}\nPor correo postal: {{siteName}}, {{address}}, {{postalCode}} {{city}}, {{country}}." },
        { question: 'Datos personales', answer: 'El tratamiento de sus datos personales se rige por nuestra Política de Privacidad, disponible en la sección « Política de Privacidad », de conformidad con el Reglamento General de Protección de Datos 2016/679 del 27 de abril de 2016 (« RGPD »).' },
        { question: 'Litigios', answer: 'En caso de litigio entre el profesional y el consumidor, ambos se esforzarán por encontrar una solución amistosa. A falta de acuerdo amistoso, el consumidor puede recurrir gratuitamente al mediador de consumo en un plazo de un año desde la reclamación escrita dirigida al profesional.' },
      ],
    },
  },
  {
    id: '444e60bc-e15c-4333-908d-04048f9a9ef8',
    pageId: PAGE_ES,
    type: 'faq',
    sortOrder: 1,
    isVisible: true,
    content: {
      title: 'Política de Privacidad',
      items: [
        { question: 'Información de la empresa', answer: "La empresa {{siteName}}, ubicada en {{address}}, {{postalCode}} {{city}}, {{country}}, es responsable del tratamiento de los datos personales recogidos en este sitio." },
        { question: 'Recogida de datos personales', answer: 'Recogemos datos personales como el nombre, la dirección de correo electrónico, la dirección postal, etc., únicamente en el marco de la prestación de nuestros servicios y productos, y con el consentimiento explícito del usuario.' },
        { question: 'Finalidad de la recogida de datos', answer: 'Los datos personales recogidos se utilizan para proporcionar nuestros servicios, procesar pedidos, mejorar nuestro sitio y productos, y comunicarnos con nuestros usuarios.' },
        { question: 'Consentimiento', answer: 'Al utilizar este sitio, usted consiente la recogida y el tratamiento de sus datos personales de conformidad con nuestra política de privacidad.' },
        { question: 'Uso de los datos', answer: 'Los datos personales se utilizan únicamente para los fines especificados en el momento de la recogida y están protegidos de conformidad con las leyes de protección de datos vigentes.' },
        { question: 'Compartir datos', answer: 'No compartimos sus datos personales con terceros, salvo en los casos previstos por la ley o con su consentimiento explícito.' },
        { question: 'Derechos de los usuarios', answer: 'Tiene derecho a acceder a sus datos personales, corregirlos, suprimirlos y oponerse a su tratamiento. Para ejercer estos derechos, contáctenos en {{email}}.' },
        { question: 'Cookies y seguimiento en línea', answer: 'Este sitio utiliza cookies y otras tecnologías de seguimiento para mejorar su experiencia de navegación y para recopilar información sobre cómo utiliza el sitio.' },
        { question: 'Actualizaciones de la política de privacidad', answer: 'Esta política de privacidad puede actualizarse periódicamente para reflejar los cambios en nuestras prácticas de privacidad. Cualquier modificación importante se indicará claramente en esta página.' },
      ],
    },
  },
  {
    id: 'e285da6d-4091-491f-9340-68995a114d35',
    pageId: PAGE_ES,
    type: 'faq',
    sortOrder: 2,
    isVisible: true,
    content: {
      title: 'Condiciones Generales de Venta',
      items: [
        { question: 'Ámbito de aplicación', answer: "Las presentes Condiciones Generales de Venta (CGV) se aplican a todos los pedidos realizados por el cliente (en adelante « el Cliente ») a {{siteName}} (en adelante « el Vendedor ») a través del sitio web {{siteName}}." },
        { question: 'Pedidos', answer: 'El Cliente puede realizar pedidos a través del sitio web {{siteName}}. Cualquier pedido implica la aceptación expresa y sin reservas de las presentes CGV.' },
        { question: 'Precios', answer: 'Los precios de los productos se indican en euros con todos los impuestos incluidos (IVA incluido). El Vendedor se reserva el derecho de modificar sus precios en cualquier momento, pero los productos se facturarán según las tarifas vigentes en el momento de la validación del pedido.' },
        { question: 'Pago', answer: 'El pago se realiza en línea con tarjeta bancaria o cualquier otro medio de pago seguro aceptado por el Vendedor. El pedido solo se procesará después de recibir el pago.' },
        { question: 'Entrega', answer: 'Los productos se entregarán en la dirección indicada por el Cliente durante el pedido. Los plazos de entrega se dan a título indicativo y pueden variar según el lugar de entrega y la disponibilidad de los productos.' },
        { question: 'Derecho de desistimiento', answer: 'De conformidad con la legislación vigente, el Cliente dispone de un plazo de 14 días para ejercer su derecho de desistimiento a partir de la recepción de los productos, sin tener que justificar motivos ni pagar penalizaciones.' },
        { question: 'Garantía', answer: 'Los productos vendidos están sujetos a la garantía legal de conformidad y a la garantía por vicios ocultos previstas por la ley. En caso de no conformidad o vicio oculto, el Cliente puede elegir entre la reparación, la sustitución o el reembolso del producto.' },
        { question: 'Responsabilidad', answer: 'El Vendedor no será responsable de los daños directos o indirectos causados por el uso de los productos vendidos. La responsabilidad del Vendedor se limita al importe del pedido.' },
        { question: 'Litigios', answer: 'En caso de litigio, se buscará prioritariamente una solución amistosa. A falta de acuerdo amistoso, el litigio se someterá a los tribunales competentes.' },
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // AR — إشعار قانوني
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'd98665aa-fbe6-4496-87bf-f2366c22edda',
    pageId: PAGE_AR,
    type: 'faq',
    sortOrder: 0,
    isVisible: true,
    content: {
      title: 'إشعار قانوني',
      intro: 'وفقًا لأحكام القانون رقم 2004-575 المؤرخ في 21 يونيو 2004 بشأن الثقة في الاقتصاد الرقمي، نود إعلامكم بهوية الأطراف المشاركة في إنشاء ومتابعة موقع {{siteName}}.',
      items: [
        { question: 'هوية الموقع', answer: 'موقع {{siteName}} تديره شركة {{siteName}}، وهي شركة مساهمة مبسطة برأسمال قدره 10,000 يورو، مسجلة في السجل التجاري تحت الرقم RCS XXXXX، ومقرها الاجتماعي في {{address}}، {{postalCode}} {{city}}، {{country}}.' },
        { question: 'الاستضافة', answer: 'يُستضاف الموقع لدى شركة Vercel Inc.، الكائنة في 340 S Lemon Ave #4133, Walnut, CA 91789، الولايات المتحدة.' },
        { question: 'مدير النشر', answer: 'مدير النشر للموقع هو السيد/السيدة [اسم مدير النشر].' },
        { question: 'اتصل بنا', answer: 'عبر البريد الإلكتروني: {{email}}\nعبر البريد: {{siteName}}، {{address}}، {{postalCode}} {{city}}، {{country}}.' },
        { question: 'البيانات الشخصية', answer: 'تخضع معالجة بياناتكم الشخصية لسياسة الخصوصية الخاصة بنا، المتاحة في قسم « سياسة الخصوصية »، وفقًا للائحة العامة لحماية البيانات 2016/679 الصادرة في 27 أبريل 2016 (« GDPR »).' },
        { question: 'النزاعات', answer: 'في حالة نزاع بين المهني والمستهلك، يسعى الطرفان لإيجاد حل ودي. في حال عدم التوصل إلى اتفاق ودي، يمكن للمستهلك اللجوء مجانًا إلى وسيط المستهلك خلال سنة من تاريخ الشكوى المكتوبة الموجهة إلى المهني.' },
      ],
    },
  },
  {
    id: '3b4eebf9-9cb1-4eaa-850d-8da1a1ab3f9d',
    pageId: PAGE_AR,
    type: 'faq',
    sortOrder: 1,
    isVisible: true,
    content: {
      title: 'سياسة الخصوصية',
      items: [
        { question: 'معلومات عن الشركة', answer: 'شركة {{siteName}}، الكائنة في {{address}}، {{postalCode}} {{city}}، {{country}}، هي المسؤولة عن معالجة البيانات الشخصية المجمعة على هذا الموقع.' },
        { question: 'جمع البيانات الشخصية', answer: 'نجمع بيانات شخصية مثل الاسم وعنوان البريد الإلكتروني والعنوان البريدي وغيرها، فقط في إطار تقديم خدماتنا ومنتجاتنا، وبموافقة صريحة من المستخدم.' },
        { question: 'الغرض من جمع البيانات', answer: 'تُستخدم البيانات الشخصية المجمعة لتقديم خدماتنا ومعالجة الطلبات وتحسين موقعنا ومنتجاتنا والتواصل مع مستخدمينا.' },
        { question: 'الموافقة', answer: 'باستخدامك لهذا الموقع، فإنك توافق على جمع ومعالجة بياناتك الشخصية وفقًا لسياسة الخصوصية الخاصة بنا.' },
        { question: 'استخدام البيانات', answer: 'تُستخدم البيانات الشخصية فقط للأغراض المحددة عند جمعها وتُحمى وفقًا لقوانين حماية البيانات المعمول بها.' },
        { question: 'مشاركة البيانات', answer: 'لا نشارك بياناتك الشخصية مع أطراف ثالثة، إلا في الحالات المنصوص عليها قانونًا أو بموافقتك الصريحة.' },
        { question: 'حقوق المستخدمين', answer: 'لديك الحق في الوصول إلى بياناتك الشخصية وتصحيحها وحذفها والاعتراض على معالجتها. لممارسة هذه الحقوق، يرجى التواصل معنا على {{email}}.' },
        { question: 'ملفات تعريف الارتباط والتتبع عبر الإنترنت', answer: 'يستخدم هذا الموقع ملفات تعريف الارتباط وتقنيات تتبع أخرى لتحسين تجربة التصفح ولجمع معلومات حول كيفية استخدامك للموقع.' },
        { question: 'تحديثات سياسة الخصوصية', answer: 'قد يتم تحديث سياسة الخصوصية هذه بشكل دوري لتعكس التغييرات في ممارسات الخصوصية لدينا. سيتم الإشارة بوضوح إلى أي تعديل مهم في هذه الصفحة.' },
      ],
    },
  },
  {
    id: '9d177248-3d7c-48be-825a-290cd7349160',
    pageId: PAGE_AR,
    type: 'faq',
    sortOrder: 2,
    isVisible: true,
    content: {
      title: 'الشروط العامة للبيع',
      items: [
        { question: 'نطاق التطبيق', answer: 'تنطبق شروط البيع العامة هذه على جميع الطلبات المقدمة من العميل (المشار إليه فيما يلي بـ « العميل ») لدى {{siteName}} (المشار إليها فيما يلي بـ « البائع ») عبر موقع {{siteName}}.' },
        { question: 'الطلبات', answer: 'يمكن للعميل تقديم طلبات عبر موقع {{siteName}}. أي طلب يعني القبول الصريح وغير المشروط لشروط البيع العامة هذه.' },
        { question: 'الأسعار', answer: 'تُعرض أسعار المنتجات باليورو شاملة جميع الضرائب. يحتفظ البائع بالحق في تعديل الأسعار في أي وقت، لكن المنتجات ستُفوتر وفقًا للأسعار السارية وقت تأكيد الطلب.' },
        { question: 'الدفع', answer: 'يتم الدفع عبر الإنترنت بالبطاقة المصرفية أو أي وسيلة دفع آمنة أخرى يقبلها البائع. لن تتم معالجة الطلب إلا بعد استلام الدفع.' },
        { question: 'التوصيل', answer: 'يتم توصيل المنتجات إلى العنوان المحدد من قبل العميل عند الطلب. مواعيد التوصيل تُعطى على سبيل الاستدلال وقد تختلف حسب مكان التوصيل وتوفر المنتجات.' },
        { question: 'حق الانسحاب', answer: 'وفقًا للتشريعات المعمول بها، يحق للعميل ممارسة حق الانسحاب خلال 14 يومًا من استلام المنتجات، دون الحاجة إلى تبرير الأسباب أو دفع غرامات.' },
        { question: 'الضمان', answer: 'تخضع المنتجات المباعة للضمان القانوني للمطابقة وضمان العيوب الخفية المنصوص عليهما قانونًا. في حالة عدم المطابقة أو العيب الخفي، يمكن للعميل الاختيار بين الإصلاح أو الاستبدال أو الاسترداد.' },
        { question: 'المسؤولية', answer: 'لا يتحمل البائع مسؤولية الأضرار المباشرة أو غير المباشرة الناجمة عن استخدام المنتجات المباعة. تقتصر مسؤولية البائع على مبلغ الطلب.' },
        { question: 'النزاعات', answer: 'في حالة النزاع، يُبحث عن حل ودي أولًا. في حال عدم التوصل إلى اتفاق ودي، يُحال النزاع إلى المحاكم المختصة.' },
      ],
    },
  },
// ══════════════════════════════════════════════════════════════════════════
  // FR — Conditions de Réservation
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: '5464bcb7-0444-4d1d-a535-0c4b125bc2d7',
    pageId: BOOK_FR,
    type: 'faq',
    sortOrder: 0,
    isVisible: true,
    content: {
      title: 'Conditions de Réservation',
      intro: "Le présent accord régit chaque réservation {{siteName}} avec la page du voyage concerné, le récapitulatif de réservation, la facture et l'itinéraire. La voyageuse doit le lire et l'accepter avant tout paiement. L'assurance voyage conforme à la page « Assurance Voyage » est une condition de participation.",
      items: [
        { question: 'Parties et acceptation', answer: "Le présent accord est conclu entre {{siteName}} et la personne identifiée dans le dossier de réservation. En cochant les cases d'acceptation, en signant électroniquement ou en effectuant un paiement, vous confirmez avoir eu la possibilité de les lire et de les enregistrer, et acceptez d'être liée par celles-ci. La version affichée et acceptée au moment de la réservation régit cette réservation. Un parent ou représentant légal doit signer pour toute voyageuse mineure." },
        { question: 'Prix, acompte et paiements', answer: "Sauf indication contraire dans le récapitulatif de réservation, l'acompte est de 500 € par voyageuse. Le solde est dû 28 jours calendaires avant le départ. La réservation n'est confirmée qu'après acceptation par {{siteName}} et encaissement effectif des fonds. Toute surcharge autorisée ou dépense facultative est communiquée avant son encaissement. Un défaut de paiement dans les délais peut être traité comme une annulation après notification écrite et délai raisonnable pour régulariser." },
        { question: 'Annulation par la voyageuse et remboursements', answer: "Toute annulation doit être envoyée par écrit à {{email}} et prend effet à sa réception. Barème standard : 121 jours ou plus avant le départ → sommes reçues moins l'acompte de 500 € et les frais non récupérables documentés ; de 61 à 120 jours → 50 % des sommes versées au-delà de l'acompte ; de 29 à 60 jours → 25 % ; 28 jours ou moins → aucun remboursement. Le remplacement par une autre voyageuse nécessite l'accord écrit de {{siteName}}." },
        { question: 'Annulation par {{siteName}} et taille minimale du groupe', answer: "{{siteName}} peut annuler un voyage si la taille minimale annoncée n'est pas atteinte ; les paiements reçus pour le forfait terrestre sont alors remboursés, sauf acceptation expresse d'un voyage de remplacement ou d'un avoir. {{siteName}} n'est pas responsable des billets d'avion achetés séparément — n'achetez pas de transport non remboursable avant la confirmation du voyage." },
        { question: 'Modifications et événements indépendants de notre volonté', answer: "Les voyages internationaux peuvent être affectés par la météo, catastrophes naturelles, épidémies, grèves, restrictions frontalières ou défaillance d'un prestataire. {{siteName}} peut apporter les modifications raisonnablement nécessaires pour protéger la sécurité ou préserver le caractère essentiel du voyage : reporter, modifier l'itinéraire, remplacer des prestations, émettre un avoir ou annuler. Tout remboursement tient compte des sommes réellement récupérées auprès des prestataires." },
        { question: 'Responsabilités de la voyageuse', answer: "Maintenir un passeport valide et obtenir tous les visas et documents de santé requis ; consulter les avis officiels de destination ; fournir des informations exactes (identité, contact d'urgence, régime alimentaire, accessibilité) dans les délais demandés ; signaler tôt tout besoin de mobilité ; respecter les lois, les consignes de sécurité et les horaires de rendez-vous." },
        { question: 'Urgences et décisions médicales', answer: "En cas d'urgence, {{siteName}} peut contacter les services d'urgence locaux, votre contact d'urgence et votre assistance, et partager les informations nécessaires pour obtenir de l'aide. {{siteName}} ne fournit pas de conseil médical et ne peut garantir la disponibilité ou la qualité des soins locaux. Si vous ne pouvez pas agir et qu'une action immédiate est nécessaire, vous autorisez {{siteName}} à organiser soins, transport ou évacuation ; vous restez responsable des frais non couverts par l'assurance." },
        { question: 'Prestataires indépendants', answer: "Hôtels, compagnies aériennes, guides, chauffeurs et autres prestataires sont des entreprises indépendantes. {{siteName}} les sélectionne et les coordonne avec soin, mais ne contrôle pas leurs opérations quotidiennes et n'est pas responsable de leurs actes ou défaillances lorsque la sélection a été faite avec diligence raisonnable." },
        { question: 'Risques et biens personnels', answer: "Le voyage international comporte des risques : routes et véhicules inhabituels, marche sur terrain accidenté, altitude, chaleur, animaux, lieux isolés, structures médicales limitées. Vous acceptez les risques ordinaires et inhérents aux activités entreprises volontairement. Vous êtes responsable de vos passeports, argent, médicaments, bagages et objets de valeur." },
        { question: 'Réclamations et litiges', answer: "Signalez tout problème de service pendant le voyage pour que {{siteName}} puisse y remédier. Après le voyage, toute réclamation doit être envoyée à {{email}} dans les 30 jours suivant la fin du voyage, avec les documents pertinents. Les parties tentent d'abord de résoudre le litige à l'amiable, puis par médiation non contraignante." },
      ],
    },
  },
  // ══════════════════════════════════════════════════════════════════════════
  // FR — Assurance Voyage
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: '6a56a4dc-99cc-4dbc-9eb8-23200090c50c',
    pageId: INS_FR,
    type: 'faq',
    sortOrder: 0,
    isVisible: true,
    content: {
      title: 'Assurance Voyage Obligatoire',
      intro: "Une assurance voyage conforme est une condition de participation à tout départ {{siteName}}. Elle vous protège, vous et le groupe, en cas d'imprévu médical, d'annulation ou d'évacuation.",
      items: [
        { question: 'Pourquoi une assurance voyage est-elle obligatoire ?', answer: "Chaque voyageuse doit souscrire et maintenir une police à son nom, valable pour toutes les dates, destinations et activités du voyage. Nos destinations incluent des zones éloignées (désert du Tassili, hauts plateaux du Kirghizistan) où une évacuation médicale peut coûter plusieurs dizaines de milliers d'euros. Sans assurance, un incident met en péril votre sécurité et celle du groupe." },
        { question: 'Garanties minimales exigées', answer: "Sauf approbation écrite d'une police équivalente par {{siteName}}, votre police doit inclure au minimum : 100 000 € de frais médicaux d'urgence hors de votre pays de résidence ; 250 000 € d'évacuation médicale d'urgence et de rapatriement médicalement nécessaire ; rapatriement de corps ; annulation et interruption de voyage jusqu'au montant prépayé non remboursable ; assistance d'urgence 24h/24." },
        { question: 'Justificatif de couverture', answer: "Vous devez transmettre la preuve de couverture dans les 14 jours calendaires suivant votre premier paiement, ou immédiatement si vous réservez moins de 45 jours avant le départ. Le justificatif doit montrer : votre nom, l'assureur, le numéro de police, le contact d'assistance d'urgence, les dates d'effet, les destinations (ou la validité mondiale) et les plafonds de garantie. Aucun dossier médical n'est exigé. L'absence de justificatif est un manquement au contrat et peut entraîner la suspension ou l'annulation de la réservation." },
        { question: "Ce que {{siteName}} ne fait pas", answer: "{{siteName}} ne fournit pas d'assurance, ne détermine pas les couvertures, ne gère pas les sinistres et ne garantit aucun paiement. Tout lien vers un assureur est fourni pour votre commodité. Vous êtes responsable de lire les exclusions, les règles relatives aux conditions préexistantes, les délais de souscription, les franchises et les exclusions liées aux épidémies, troubles civils, guerre ou avis gouvernementaux." },
        { question: 'Proposer une assurance en option', answer: "Notre service « Assurance et assistance voyage » (39 €) vous permet de souscrire une couverture conforme en cinq minutes lors de la réservation, avec attestation immédiate par email — valable notamment pour le visa algérien. Vous restez libre de choisir tout autre assureur respectant les garanties minimales ci-dessus." },
        { question: 'En cas de sinistre pendant le voyage', answer: "Contactez d'abord votre assistance 24h/24 (numéro sur votre attestation), puis informez l'accompagnatrice {{siteName}}. Conservez toutes les factures et rapports. {{siteName}} vous aidera dans les démarches documentaires raisonnables, mais la décision d'indemnisation appartient exclusivement à votre assureur." },
      ],
    },
  },
  // ══════════════════════════════════════════════════════════════════════════
  // EN — Booking Terms
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ad1eea48-4f03-40d5-a493-372401e83a38',
    pageId: BOOK_EN,
    type: 'faq',
    sortOrder: 0,
    isVisible: true,
    content: {
      title: 'Booking Terms',
      intro: 'This agreement governs every {{siteName}} booking together with the applicable trip page, booking summary, invoice, and itinerary. The traveler must read and accept it before payment. Travel insurance meeting the "Travel Insurance" page is a condition of participation.',
      items: [
        { question: 'Parties and acceptance', answer: 'This agreement is between {{siteName}} and the person identified in the booking record. By checking the acceptance boxes, electronically signing, or submitting payment, you confirm that you had an opportunity to read and save these terms and agree to be bound by them. The agreement version displayed and accepted at the time of booking controls that booking. A parent or legal guardian must sign for any traveler under age 18.' },
        { question: 'Price, deposits and payments', answer: 'Unless the booking summary states otherwise, the reservation deposit is €500 per traveler. The remaining balance is due 28 calendar days before departure. A reservation is not confirmed until {{siteName}} accepts the booking and receives cleared funds. Any permitted surcharge or optional charge is disclosed before collection. Failure to pay on time may be treated as a traveler cancellation after written notice and a reasonable opportunity to cure.' },
        { question: 'Traveler cancellation and refunds', answer: 'A cancellation must be sent in writing to {{email}} and is effective when {{siteName}} receives it. Standard schedule: 121 or more days before departure → payments received, less the €500 deposit and documented nonrecoverable supplier charges; 61 to 120 days → 50% of amounts paid above the deposit; 29 to 60 days → 25%; 28 days or fewer → no refund. Traveler substitutions require written approval from {{siteName}}.' },
        { question: 'Cancellation by {{siteName}} and minimum group size', answer: '{{siteName}} may cancel a trip if the stated minimum group size is not reached; payments received for the land package will be refunded unless you expressly accept a replacement trip or credit. {{siteName}} is not responsible for independently purchased airfare — do not purchase nonrefundable transportation until the trip is confirmed.' },
        { question: 'Changes and events beyond reasonable control', answer: 'International travel can be affected by weather, natural disasters, epidemics, strikes, border restrictions, or supplier failure. {{siteName}} may make reasonably necessary changes to protect safety or preserve the trip\'s essential character: postpone, reroute, substitute services, issue a credit, or cancel. Any refund reflects money actually recovered from suppliers.' },
        { question: 'Traveler responsibilities', answer: 'Maintain a valid passport and obtain all required visas and health documents; review official destination advisories; provide accurate identity, emergency contact, dietary and accessibility information by the requested deadlines; disclose mobility needs early; follow laws, safety instructions, meeting times and respectful group conduct.' },
        { question: 'Emergencies and medical decisions', answer: 'In an emergency, {{siteName}} may contact local emergency services, your emergency contact, and your assistance provider, and may share information reasonably necessary to obtain help. {{siteName}} does not provide medical advice and cannot guarantee the availability or quality of local care. If you cannot act and immediate action is reasonably necessary, you authorize {{siteName}} to assist in arranging medical care, transportation, or evacuation; you remain responsible for charges not paid by insurance.' },
        { question: 'Independent suppliers', answer: 'Hotels, airlines, guides, drivers and other suppliers are independent businesses. {{siteName}} selects and coordinates suppliers but does not control their day-to-day operations and is not responsible for their acts or failures when reasonable care was exercised in selection and coordination.' },
        { question: 'Risks and personal property', answer: 'International travel involves risks: unfamiliar roads and vehicles, walking on uneven surfaces, altitude, heat, animals, remote locations, limited medical facilities. You accept the ordinary and inherent risks of activities you voluntarily undertake. You are responsible for your passports, money, medications, luggage, and valuables.' },
        { question: 'Complaints and disputes', answer: 'Report any service problem promptly during the trip so {{siteName}} has a reasonable opportunity to address it. Post-trip complaints should be sent to {{email}} within 30 days after the trip ends, with relevant documents. The parties will first attempt to resolve the dispute directly, then through nonbinding mediation.' },
      ],
    },
  },
  // ══════════════════════════════════════════════════════════════════════════
  // EN — Travel Insurance
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'b4fe6413-a2d0-437b-a266-f83384251c6f',
    pageId: INS_EN,
    type: 'faq',
    sortOrder: 0,
    isVisible: true,
    content: {
      title: 'Mandatory Travel Insurance',
      intro: 'Qualifying travel insurance is a condition of participation on every {{siteName}} departure. It protects you and the group in case of medical emergency, cancellation, or evacuation.',
      items: [
        { question: 'Why is travel insurance mandatory?', answer: 'Every traveler must purchase and maintain a policy issued in her name, valid for all trip dates, destinations, and planned activities. Our destinations include remote areas (the Tassili desert, the Kyrgyz highlands) where a medical evacuation can cost tens of thousands of euros. Without insurance, an incident endangers your safety and the group\'s.' },
        { question: 'Minimum required coverage', answer: 'Unless {{siteName}} approves an equivalent policy in writing, your policy must include at least: €100,000 in emergency medical coverage outside your home country; €250,000 in emergency medical evacuation and medically necessary repatriation coverage; repatriation of remains; trip cancellation and interruption coverage up to your prepaid, nonrefundable insured trip cost; twenty-four-hour emergency assistance.' },
        { question: 'Proof of coverage', answer: 'You must submit proof of coverage within 14 calendar days after the initial payment, or immediately if booking fewer than 45 days before departure. Proof should show your name, insurer, policy number, emergency-assistance contact, effective dates, destinations (or worldwide validity), and coverage limits. No medical records are required. Failure to provide acceptable proof is a breach of this agreement and may result in suspension or cancellation of the booking.' },
        { question: 'What {{siteName}} does not do', answer: '{{siteName}} does not provide insurance, determine coverage, adjust claims, or guarantee payment. Any insurance link is supplied for convenience. You are responsible for reviewing exclusions, pre-existing-condition rules, purchase deadlines, deductibles, activity restrictions, and exclusions involving epidemics, civil unrest, war, terrorism, or government advisories.' },
        { question: 'Insurance as an option', answer: 'Our "Travel insurance and assistance" service (€39) lets you take out compliant coverage in five minutes at booking, with an immediate certificate by email — valid for the Algeria visa among others. You remain free to choose any other insurer meeting the minimum coverage above.' },
        { question: 'If something happens during the trip', answer: 'Contact your 24-hour assistance first (number on your certificate), then inform the {{siteName}} tour leader. Keep all invoices and reports. {{siteName}} will provide reasonable help with documentation, but the claims decision belongs exclusively to your insurer.' },
      ],
    },
  },
  // ══════════════════════════════════════════════════════════════════════════
  // ES — Condiciones de Reserva
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: '09ee6145-749a-4ac8-a131-722d72b31541',
    pageId: BOOK_ES,
    type: 'faq',
    sortOrder: 0,
    isVisible: true,
    content: {
      title: 'Condiciones de Reserva',
      intro: 'El presente acuerdo rige cada reserva de {{siteName}} junto con la página del viaje, el resumen de reserva, la factura y el itinerario. La viajera debe leerlo y aceptarlo antes de cualquier pago. El seguro de viaje conforme a la página « Seguro de Viaje » es una condición de participación.',
      items: [
        { question: 'Partes y aceptación', answer: 'Este acuerdo se celebra entre {{siteName}} y la persona identificada en el expediente de reserva. Al marcar las casillas de aceptación, firmar electrónicamente o efectuar un pago, confirmas que has tenido la oportunidad de leer y guardar estas condiciones y aceptas quedar vinculada por ellas. La versión mostrada y aceptada en el momento de la reserva rige esa reserva. Un padre o tutor legal debe firmar por cualquier viajera menor de 18 años.' },
        { question: 'Precio, depósito y pagos', answer: 'Salvo indicación contraria en el resumen de reserva, el depósito es de 500 € por viajera. El saldo vence 28 días naturales antes de la salida. La reserva no se confirma hasta que {{siteName}} la acepta y recibe los fondos. Cualquier suplemento autorizado o gasto opcional se comunica antes de su cobro. El impago a tiempo puede tratarse como cancelación por la viajera tras notificación escrita y un plazo razonable para regularizar.' },
        { question: 'Cancelación por la viajera y reembolsos', answer: 'Toda cancelación debe enviarse por escrito a {{email}} y surte efecto a su recepción. Baremo estándar: 121 días o más antes de la salida → importes recibidos menos el depósito de 500 € y los gastos no recuperables documentados; de 61 a 120 días → 50 % de lo pagado por encima del depósito; de 29 a 60 días → 25 %; 28 días o menos → sin reembolso. La sustitución por otra viajera requiere la aprobación escrita de {{siteName}}.' },
        { question: 'Cancelación por {{siteName}} y tamaño mínimo del grupo', answer: '{{siteName}} puede cancelar un viaje si no se alcanza el tamaño mínimo anunciado; los pagos recibidos por el paquete terrestre se reembolsan, salvo aceptación expresa de un viaje de sustitución o un bono. {{siteName}} no es responsable de los billetes de avión comprados por separado — no compres transporte no reembolsable antes de la confirmación del viaje.' },
        { question: 'Cambios y eventos fuera de nuestro control', answer: 'Los viajes internacionales pueden verse afectados por meteorología, desastres naturales, epidemias, huelgas, restricciones fronterizas o fallos de proveedores. {{siteName}} puede realizar los cambios razonablemente necesarios para proteger la seguridad o preservar el carácter esencial del viaje: aplazar, modificar el itinerario, sustituir prestaciones, emitir un bono o cancelar. Todo reembolso refleja las cantidades realmente recuperadas de los proveedores.' },
        { question: 'Responsabilidades de la viajera', answer: 'Mantener un pasaporte válido y obtener todos los visados y documentos sanitarios requeridos; consultar los avisos oficiales del destino; facilitar información exacta (identidad, contacto de emergencia, dieta, accesibilidad) en los plazos solicitados; comunicar pronto cualquier necesidad de movilidad; respetar las leyes, las consignas de seguridad y los horarios de encuentro.' },
        { question: 'Emergencias y decisiones médicas', answer: 'En una emergencia, {{siteName}} puede contactar con los servicios de emergencia locales, tu contacto de emergencia y tu asistencia, y compartir la información razonablemente necesaria para obtener ayuda. {{siteName}} no da consejo médico ni puede garantizar la disponibilidad o calidad de la atención local. Si no puedes actuar y es razonablemente necesario actuar de inmediato, autorizas a {{siteName}} a organizar atención médica, transporte o evacuación; sigues siendo responsable de los gastos no cubiertos por el seguro.' },
        { question: 'Proveedores independientes', answer: 'Hoteles, aerolíneas, guías, conductores y otros proveedores son empresas independientes. {{siteName}} los selecciona y coordina, pero no controla sus operaciones diarias ni responde de sus actos o fallos cuando la selección se hizo con la diligencia debida.' },
        { question: 'Riesgos y bienes personales', answer: 'El viaje internacional conlleva riesgos: carreteras y vehículos desconocidos, caminatas por terreno irregular, altitud, calor, animales, lugares remotos, estructuras médicas limitadas. Aceptas los riesgos ordinarios e inherentes de las actividades que emprendes voluntariamente. Eres responsable de tu pasaporte, dinero, medicamentos, equipaje y objetos de valor.' },
        { question: 'Reclamaciones y litigios', answer: 'Comunica cualquier problema de servicio durante el viaje para que {{siteName}} pueda abordarlo. Tras el viaje, las reclamaciones deben enviarse a {{email}} dentro de los 30 días siguientes al final del viaje, con los documentos pertinentes. Las partes intentan primero resolver el litigio directamente y después mediante mediación no vinculante.' },
      ],
    },
  },
  // ══════════════════════════════════════════════════════════════════════════
  // ES — Seguro de Viaje
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'f10d65ce-fdb1-445a-9457-c8d623ac7b2a',
    pageId: INS_ES,
    type: 'faq',
    sortOrder: 0,
    isVisible: true,
    content: {
      title: 'Seguro de Viaje Obligatorio',
      intro: 'Un seguro de viaje conforme es una condición de participación en cada salida de {{siteName}}. Te protege a ti y al grupo en caso de emergencia médica, cancelación o evacuación.',
      items: [
        { question: '¿Por qué es obligatorio el seguro de viaje?', answer: 'Cada viajera debe contratar y mantener una póliza a su nombre, válida para todas las fechas, destinos y actividades del viaje. Nuestros destinos incluyen zonas remotas (el desierto del Tassili, las tierras altas de Kirguistán) donde una evacuación médica puede costar decenas de miles de euros. Sin seguro, un incidente pone en riesgo tu seguridad y la del grupo.' },
        { question: 'Coberturas mínimas exigidas', answer: 'Salvo aprobación escrita de una póliza equivalente por {{siteName}}, tu póliza debe incluir como mínimo: 100 000 € de gastos médicos de urgencia fuera de tu país de residencia; 250 000 € de evacuación médica de urgencia y repatriación médicamente necesaria; repatriación de restos; cancelación e interrupción del viaje hasta el importe prepagado no reembolsable; asistencia de emergencia 24 horas.' },
        { question: 'Justificante de cobertura', answer: 'Debes enviar la prueba de cobertura en los 14 días naturales siguientes a tu primer pago, o inmediatamente si reservas menos de 45 días antes de la salida. El justificante debe mostrar: tu nombre, la aseguradora, el número de póliza, el contacto de asistencia de emergencia, las fechas de vigencia, los destinos (o validez mundial) y los límites de cobertura. No se exige ningún historial médico. La ausencia de justificante es un incumplimiento del contrato y puede provocar la suspensión o cancelación de la reserva.' },
        { question: 'Lo que {{siteName}} no hace', answer: '{{siteName}} no proporciona seguros, no determina coberturas, no gestiona siniestros y no garantiza ningún pago. Cualquier enlace a una aseguradora se facilita para tu comodidad. Eres responsable de revisar las exclusiones, las reglas sobre condiciones preexistentes, los plazos de contratación, las franquicias y las exclusiones por epidemias, disturbios civiles, guerra o avisos gubernamentales.' },
        { question: 'Seguro como opción', answer: 'Nuestro servicio « Seguro y asistencia de viaje » (39 €) te permite contratar una cobertura conforme en cinco minutos al reservar, con certificado inmediato por email — válido entre otros para el visado argelino. Sigues siendo libre de elegir cualquier otra aseguradora que respete las coberturas mínimas anteriores.' },
        { question: 'Si ocurre algo durante el viaje', answer: 'Contacta primero con tu asistencia 24 horas (número en tu certificado) y luego informa a la acompañante de {{siteName}}. Conserva todas las facturas e informes. {{siteName}} te ayudará razonablemente con la documentación, pero la decisión de indemnización corresponde exclusivamente a tu aseguradora.' },
      ],
    },
  },
  // ══════════════════════════════════════════════════════════════════════════
  // AR — شروط الحجز
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'e664cf90-45b1-42a0-bb0d-2c8418608558',
    pageId: BOOK_AR,
    type: 'faq',
    sortOrder: 0,
    isVisible: true,
    content: {
      title: 'شروط الحجز',
      intro: 'يحكم هذا الاتفاق كل حجز لدى {{siteName}} إلى جانب صفحة الرحلة المعنية وملخص الحجز والفاتورة وخط السير. يجب على المسافرة قراءته وقبوله قبل أي دفع. ويُعد تأمين السفر الموافق لصفحة « تأمين السفر » شرطاً للمشاركة.',
      items: [
        { question: 'الأطراف والقبول', answer: 'يُبرم هذا الاتفاق بين {{siteName}} والشخص المحدد في ملف الحجز. عند تحديد خانات القبول أو التوقيع إلكترونياً أو إجراء دفعة، تؤكدين أنك تمكنت من قراءة هذه الشروط وحفظها وتوافقين على الالتزام بها. النسخة المعروضة والمقبولة وقت الحجز هي التي تحكم ذلك الحجز. ويجب على أحد الوالدين أو الوصي القانوني التوقيع عن أي مسافرة دون سن 18.' },
        { question: 'السعر والدفعة المقدمة والمدفوعات', answer: 'ما لم يذكر ملخص الحجز خلاف ذلك، تبلغ الدفعة المقدمة 500 يورو لكل مسافرة. ويستحق الرصيد المتبقي قبل 28 يوماً تقويمياً من المغادرة. لا يُؤكد الحجز إلا بعد قبول {{siteName}} له واستلام الأموال فعلياً. وأي رسم إضافي مسموح به أو مصروف اختياري يُفصح عنه قبل تحصيله. وقد يُعامل التأخر في الدفع كإلغاء من المسافرة بعد إشعار كتابي ومهلة معقولة للتسوية.' },
        { question: 'إلغاء المسافرة والاسترداد', answer: 'يجب إرسال أي إلغاء كتابةً إلى {{email}} ويسري عند استلام {{siteName}} له. الجدول القياسي: 121 يوماً أو أكثر قبل المغادرة ← المبالغ المستلمة ناقص الدفعة المقدمة 500 يورو والرسوم غير القابلة للاسترداد الموثقة؛ من 61 إلى 120 يوماً ← 50٪ مما دُفع فوق الدفعة المقدمة؛ من 29 إلى 60 يوماً ← 25٪؛ 28 يوماً أو أقل ← لا استرداد. ويتطلب الاستبدال بمسافرة أخرى موافقة كتابية من {{siteName}}.' },
        { question: 'الإلغاء من طرف {{siteName}} والحد الأدنى لحجم المجموعة', answer: 'يجوز لـ {{siteName}} إلغاء رحلة إذا لم يُبلغ الحد الأدنى المعلن لحجم المجموعة؛ وتُرد المدفوعات المستلمة عن الباقة الأرضية ما لم تقبلي صراحةً رحلة بديلة أو رصيداً. ولا تتحمل {{siteName}} مسؤولية تذاكر الطيران المشتراة بشكل مستقل — لا تشتري نقلًا غير قابل للاسترداد قبل تأكيد الرحلة.' },
        { question: 'التعديلات والأحداث الخارجة عن إرادتنا', answer: 'قد تتأثر الرحلات الدولية بالطقس والكوارث الطبيعية والأوبئة والإضرابات والقيود الحدودية أو إخفاق أحد الموردين. ويجوز لـ {{siteName}} إجراء التعديلات الضرورية المعقولة لحماية السلامة أو الحفاظ على الطابع الجوهري للرحلة: التأجيل أو تعديل المسار أو استبدال الخدمات أو إصدار رصيد أو الإلغاء. ويعكس أي استرداد المبالغ المستردة فعلياً من الموردين.' },
        { question: 'مسؤوليات المسافرة', answer: 'الحفاظ على جواز سفر ساري المفعول والحصول على جميع التأشيرات والوثائق الصحية المطلوبة؛ مراجعة الإرشادات الرسمية للوجهة؛ تقديم معلومات دقيقة (الهوية، جهة اتصال الطوارئ، النظام الغذائي، إمكانية الوصول) في المواعيد المطلوبة؛ الإفصاح مبكراً عن أي احتياجات تنقل؛ احترام القوانين وتعليمات السلامة ومواعيد اللقاء.' },
        { question: 'حالات الطوارئ والقرارات الطبية', answer: 'في حالة الطوارئ، يجوز لـ {{siteName}} الاتصال بخدمات الطوارئ المحلية وجهة اتصال الطوارئ الخاصة بك ومزود المساعدة، ومشاركة المعلومات اللازمة بشكل معقول للحصول على المساعدة. لا تقدم {{siteName}} استشارات طبية ولا تضمن توفر الرعاية المحلية أو جودتها. وإذا تعذر عليك التصرف وكان التصرف الفوري ضرورياً بشكل معقول، فإنك تفوضين {{siteName}} بالمساعدة في ترتيب الرعاية الطبية أو النقل أو الإخلاء؛ وتبقين مسؤولة عن الرسوم التي لا يغطيها التأمين.' },
        { question: 'الموردون المستقلون', answer: 'الفنادق وشركات الطيران والمرشدات والسائقون وغيرهم من الموردين شركات مستقلة. تختارهم {{siteName}} وتنسقهم بعناية، لكنها لا تتحكم في عملياتهم اليومية ولا تتحمل مسؤولية أفعالهم أو إخفاقاتهم عندما يُبذل الاعتناء الواجب في الاختيار والتنسيق.' },
        { question: 'المخاطر والممتلكات الشخصية', answer: 'ينطوي السفر الدولي على مخاطر: طرق ومركبات غير مألوفة، ومشي على أسطح غير مستوية، وارتفاع، وحرارة، وحيوانات، ومواقع نائية، ومرافق طبية محدودة. تقبلين المخاطر العادية والمتأصلة في الأنشطة التي تمارسينها طوعاً. وأنت مسؤولة عن جواز سفرك وأموالك وأدويتك وأمتعتك وأغراضك الثمينة.' },
        { question: 'الشكاوى والنزاعات', answer: 'أبلغي عن أي مشكلة في الخدمة أثناء الرحلة لتتاح لـ {{siteName}} فرصة معقولة لمعالجتها. وبعد الرحلة، تُرسل الشكاوى إلى {{email}} خلال 30 يوماً من انتهاء الرحلة مع المستندات ذات الصلة. ويحاول الطرفان أولاً حل النزاع مباشرةً ثم عبر وساطة غير ملزمة.' },
      ],
    },
  },
  // ══════════════════════════════════════════════════════════════════════════
  // AR — تأمين السفر
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: '1a282deb-85a7-4a0a-8c31-a3eba6053437',
    pageId: INS_AR,
    type: 'faq',
    sortOrder: 0,
    isVisible: true,
    content: {
      title: 'تأمين السفر الإلزامي',
      intro: 'يُعد تأمين السفر المؤهل شرطاً للمشاركة في كل مغادرة لـ {{siteName}}. فهو يحميك ويحمي المجموعة في حالات الطوارئ الطبية أو الإلغاء أو الإخلاء.',
      items: [
        { question: 'لماذا تأمين السفر إلزامي؟', answer: 'يجب على كل مسافرة شراء بوليصة باسمها والمحافظة عليها، صالحة لجميع تواريخ الرحلة ووجهاتها وأنشطتها المخططة. وتشمل وجهاتنا مناطق نائية (صحراء طاسيلي، مرتفعات قيرغيزستان) حيث قد تكلف عملية إخلاء طبي عشرات الآلاف من اليورو. وبدون تأمين، يعرض أي حادث سلامتك وسلامة المجموعة للخطر.' },
        { question: 'الحد الأدنى من التغطية المطلوبة', answer: 'ما لم توافق {{siteName}} كتابةً على بوليصة مكافئة، يجب أن تشمل بوليصتك كحد أدنى: 100 000 يورو لتغطية طبية طارئة خارج بلد إقامتك؛ 250 000 يورو للإخلاء الطبي الطارئ والإعادة الطبية اللازمة إلى الوطن؛ إعادة الرفات؛ تغطية إلغاء الرحلة وانقطاعها حتى مبلغ رحلتك المدفوع مسبقاً غير القابل للاسترداد؛ مساعدة طوارئ على مدار 24 ساعة.' },
        { question: 'إثبات التغطية', answer: 'يجب تقديم إثبات التغطية خلال 14 يوماً تقويمياً من الدفعة الأولى، أو فوراً إذا حجزت قبل أقل من 45 يوماً من المغادرة. ويجب أن يُظهر الإثبات: اسمك، وشركة التأمين، ورقم البوليصة، وجهة اتصال مساعدة الطوارئ، وتواريخ السريان، والوجهات (أو الصلاحية العالمية)، وحدود التغطية. ولا تُطلب أي سجلات طبية. ويُعد عدم تقديم إثبات مقبول إخلالاً بالاتفاق وقد يؤدي إلى تعليق الحجز أو إلغائه.' },
        { question: 'ما لا تقوم به {{siteName}}', answer: 'لا تقدم {{siteName}} التأمين ولا تحدد التغطيات ولا تدير المطالبات ولا تضمن أي دفع. وأي رابط لشركة تأمين يُقدم للتيسير عليك. وأنت مسؤولة عن مراجعة الاستثناءات وقواعد الحالات المرضية السابقة ومواعيد الشراء النهائية والتحملات واستثناءات الأوبئة والاضطرابات المدنية والحرب أو الإرشادات الحكومية.' },
        { question: 'التأمين كخيار', answer: 'تتيح لك خدمة « تأمين ومساعدة السفر » (39 يورو) الاشتراك في تغطية مؤهلة في خمس دقائق عند الحجز، مع شهادة فورية بالبريد الإلكتروني — صالحة من بين أمور أخرى لتأشيرة الجزائر. وتبقين حرة في اختيار أي شركة تأمين أخرى تستوفي الحد الأدنى من التغطية أعلاه.' },
        { question: 'إذا حدث شيء أثناء الرحلة', answer: 'اتصلي أولاً بمساعدتك المتاحة على مدار 24 ساعة (الرقم على شهادتك)، ثم أبلغي مرافقة {{siteName}}. واحتفظي بجميع الفواتير والتقارير. وستساعدك {{siteName}} بشكل معقول في الوثائق، لكن قرار التعويض يعود حصراً لشركة التأمين الخاصة بك.' },
      ],
    },
  },
];
