import type { Locale } from "@i18n/config";
import { renderEmailHtml, renderEmailText, type EmailSection } from "./layout";
import { getEmailTranslations } from "./i18n";
import type { VoyageEmailTemplate } from "@database/schemas/email-voyage.schema";

// 12 templates transactionnels voyage × 4 langues (TODO §14.1).
// Variables {name} {trip} {number} {dates} {amount} {date} {url} interpolées.
// Contenu 100 % localisé, URLs 100 % ASCII.

export interface VoyageEmailVars {
  name?: string;
  trip?: string;
  number?: string;
  dates?: string;
  amount?: string;
  date?: string;
  url?: string;
}

interface Entry {
  subject: string;
  heading: string;
  greeting: string;
  body: string;
  buttonText?: string;
  extra?: string;
  footnote: string;
}

type Pack = Record<VoyageEmailTemplate, Record<Locale, Entry>>;

const FOOT = {
  fr: "ATLASELLE — voyages en petits groupes. Répondez à cet e-mail pour toute question.",
  en: "ATLASELLE — small-group journeys. Reply to this email with any question.",
  es: "ATLASELLE — viajes en grupos pequeños. Responda a este correo ante cualquier duda.",
  ar: "ATLASELLE — رحلات بمجموعات صغيرة. رد على هذه الرسالة لأي سؤال.",
} satisfies Record<Locale, string>;

const T: Pack = {
  application_received: {
    fr: { subject: "Candidature reçue — {trip}", heading: "Candidature reçue", greeting: "Bonjour {name},", body: "Nous avons bien reçu votre candidature pour « {trip} ». Notre équipe la relit et revient vers vous par e-mail.", footnote: FOOT.fr },
    en: { subject: "Application received — {trip}", heading: "Application received", greeting: "Hello {name},", body: "We received your application for “{trip}”. Our team is reviewing it and will reply by email.", footnote: FOOT.en },
    es: { subject: "Solicitud recibida — {trip}", heading: "Solicitud recibida", greeting: "Hola {name},", body: "Hemos recibido su solicitud para «{trip}». Nuestro equipo la revisará y responderá por correo.", footnote: FOOT.es },
    ar: { subject: "تم استلام الطلب — {trip}", heading: "تم استلام الطلب", greeting: "مرحبا {name}،", body: "استلمنا طلبك لرحلة «{trip}». سيراجعه فريقنا ويرد عليك بالبريد.", footnote: FOOT.ar },
  },
  application_approved: {
    fr: { subject: "Candidature acceptée — {trip}", heading: "Bonne nouvelle !", greeting: "Bonjour {name},", body: "Votre candidature pour « {trip} » est acceptée. Finalisez votre réservation avant le {date} via le lien ci-dessous.", buttonText: "Réserver ma place", extra: "Lien valable 7 jours.", footnote: FOOT.fr },
    en: { subject: "Application approved — {trip}", heading: "Good news!", greeting: "Hello {name},", body: "Your application for “{trip}” is approved. Complete your booking before {date} with the link below.", buttonText: "Book my seat", extra: "Link valid 7 days.", footnote: FOOT.en },
    es: { subject: "Solicitud aceptada — {trip}", heading: "¡Buenas noticias!", greeting: "Hola {name},", body: "Su solicitud para «{trip}» ha sido aceptada. Complete su reserva antes del {date} con el enlace.", buttonText: "Reservar mi plaza", extra: "Enlace válido 7 días.", footnote: FOOT.es },
    ar: { subject: "تم قبول الطلب — {trip}", heading: "أخبار سارة!", greeting: "مرحبا {name}،", body: "تم قبول طلبك لرحلة «{trip}». أكمل حجزك قبل {date} عبر الرابط.", buttonText: "احجز مقعدك", extra: "الرابط صالح 7 أيام.", footnote: FOOT.ar },
  },
  application_contact_required: {
    fr: { subject: "Votre candidature — {trip}", heading: "Un échange avant de partir", greeting: "Bonjour {name},", body: "Pour votre candidature à « {trip} », nous aimerions échanger quelques minutes. Répondez simplement à cet e-mail.", footnote: FOOT.fr },
    en: { subject: "Your application — {trip}", heading: "A quick chat first", greeting: "Hello {name},", body: "For your application to “{trip}”, we would like a quick chat. Just reply to this email.", footnote: FOOT.en },
    es: { subject: "Su solicitud — {trip}", heading: "Hablemos antes", greeting: "Hola {name},", body: "Para su solicitud a «{trip}» nos gustaría conversar unos minutos. Responda a este correo.", footnote: FOOT.es },
    ar: { subject: "طلبك — {trip}", heading: "لنتحدث أولا", greeting: "مرحبا {name}،", body: "بخصوص طلبك لرحلة «{trip}» نود التحدث قليلا. رد على هذه الرسالة.", footnote: FOOT.ar },
  },
  application_declined: {
    fr: { subject: "Votre candidature — {trip}", heading: "Merci pour votre confiance", greeting: "Bonjour {name},", body: "Nous ne pouvons pas retenir votre candidature pour « {trip} » cette fois. D'autres départs arrivent — restons en contact.", footnote: FOOT.fr },
    en: { subject: "Your application — {trip}", heading: "Thank you for your trust", greeting: "Hello {name},", body: "We cannot take your application for “{trip}” further this time. More departures are coming — let's stay in touch.", footnote: FOOT.en },
    es: { subject: "Su solicitud — {trip}", heading: "Gracias por su confianza", greeting: "Hola {name},", body: "No podemos aceptar su solicitud para «{trip}» esta vez. Habrá más salidas — sigamos en contacto.", footnote: FOOT.es },
    ar: { subject: "طلبك — {trip}", heading: "شكرا لثقتك", greeting: "مرحبا {name}،", body: "لا يمكننا قبول طلبك لرحلة «{trip}» هذه المرة. مواعيد أخرى قادمة — لنبق على تواصل.", footnote: FOOT.ar },
  },
  checkout_started: {
    fr: { subject: "Finalisez votre réservation — {trip}", heading: "Plus qu'une étape", greeting: "Bonjour {name},", body: "Votre place pour « {trip} » est mise de côté 30 minutes. Terminez votre paiement via le lien ci-dessous.", buttonText: "Payer", extra: "Sans paiement, la place est libérée.", footnote: FOOT.fr },
    en: { subject: "Complete your booking — {trip}", heading: "One step left", greeting: "Hello {name},", body: "Your seat for “{trip}” is held for 30 minutes. Finish payment with the link below.", buttonText: "Pay now", extra: "Without payment, the seat is released.", footnote: FOOT.en },
    es: { subject: "Complete su reserva — {trip}", heading: "Solo un paso", greeting: "Hola {name},", body: "Su plaza para «{trip}» está reservada 30 minutos. Complete el pago con el enlace.", buttonText: "Pagar", extra: "Sin pago, la plaza se libera.", footnote: FOOT.es },
    ar: { subject: "أكمل حجزك — {trip}", heading: "خطوة واحدة", greeting: "مرحبا {name}،", body: "مقعدك لرحلة «{trip}» محجوز 30 دقيقة. أكمل الدفع عبر الرابط.", buttonText: "ادفع", extra: "بدون دفع يُحرر المقعد.", footnote: FOOT.ar },
  },
  payment_received: {
    fr: { subject: "Paiement reçu — {trip}", heading: "Paiement reçu", greeting: "Bonjour {name},", body: "Nous avons reçu votre paiement de {amount} pour « {trip} ». Votre réservation est en cours de confirmation.", footnote: FOOT.fr },
    en: { subject: "Payment received — {trip}", heading: "Payment received", greeting: "Hello {name},", body: "We received your payment of {amount} for “{trip}”. Your booking is being confirmed.", footnote: FOOT.en },
    es: { subject: "Pago recibido — {trip}", heading: "Pago recibido", greeting: "Hola {name},", body: "Hemos recibido su pago de {amount} para «{trip}». Su reserva está en confirmación.", footnote: FOOT.es },
    ar: { subject: "تم استلام الدفع — {trip}", heading: "تم استلام الدفع", greeting: "مرحبا {name}،", body: "استلمنا دفعتك {amount} لرحلة «{trip}». حجزك قيد التأكيد.", footnote: FOOT.ar },
  },
  booking_confirmed: {
    fr: { subject: "Réservation confirmée — {trip}", heading: "C'est confirmé !", greeting: "Bonjour {name},", body: "Votre place pour « {trip} » ({dates}) est réservée. Numéro : {number}. Détails ci-dessous.", buttonText: "Voir ma réservation", footnote: FOOT.fr },
    en: { subject: "Booking confirmed — {trip}", heading: "Confirmed!", greeting: "Hello {name},", body: "Your seat for “{trip}” ({dates}) is booked. Number: {number}. Details below.", buttonText: "View my booking", footnote: FOOT.en },
    es: { subject: "Reserva confirmada — {trip}", heading: "¡Confirmado!", greeting: "Hola {name},", body: "Su plaza para «{trip}» ({dates}) está reservada. Número: {number}.", buttonText: "Ver mi reserva", footnote: FOOT.es },
    ar: { subject: "تم تأكيد الحجز — {trip}", heading: "تم التأكيد!", greeting: "مرحبا {name}،", body: "تم حجز مقعدك لرحلة «{trip}» ({dates}). الرقم: {number}.", buttonText: "عرض حجزي", footnote: FOOT.ar },
  },
  balance_due: {
    fr: { subject: "Solde à régler — {trip}", heading: "Pensez au solde", greeting: "Bonjour {name},", body: "Le solde de {amount} pour « {trip} » est dû avant le {date}. Réglez-le via le lien ci-dessous.", buttonText: "Régler le solde", footnote: FOOT.fr },
    en: { subject: "Balance due — {trip}", heading: "Balance reminder", greeting: "Hello {name},", body: "The balance of {amount} for “{trip}” is due before {date}. Pay with the link below.", buttonText: "Pay balance", footnote: FOOT.en },
    es: { subject: "Saldo pendiente — {trip}", heading: "Recuerde el saldo", greeting: "Hola {name},", body: "El saldo de {amount} para «{trip}» vence el {date}. Pague con el enlace.", buttonText: "Pagar el saldo", footnote: FOOT.es },
    ar: { subject: "الرصيد مستحق — {trip}", heading: "تذكير بالرصيد", greeting: "مرحبا {name}،", body: "رصيد {amount} لرحلة «{trip}» مستحق قبل {date}. ادفع عبر الرابط.", buttonText: "ادفع الرصيد", footnote: FOOT.ar },
  },
  balance_reminder: {
    fr: { subject: "Rappel : solde à régler — {trip}", heading: "Dernier rappel", greeting: "Bonjour {name},", body: "Sans règlement de {amount} avant le {date}, votre place pour « {trip} » sera libérée.", buttonText: "Régler maintenant", footnote: FOOT.fr },
    en: { subject: "Reminder: balance due — {trip}", heading: "Last reminder", greeting: "Hello {name},", body: "Without payment of {amount} before {date}, your seat for “{trip}” will be released.", buttonText: "Pay now", footnote: FOOT.en },
    es: { subject: "Recordatorio: saldo — {trip}", heading: "Último aviso", greeting: "Hola {name},", body: "Sin el pago de {amount} antes del {date}, su plaza para «{trip}» se liberará.", buttonText: "Pagar ahora", footnote: FOOT.es },
    ar: { subject: "تذكير: الرصيد — {trip}", heading: "تذكير أخير", greeting: "مرحبا {name}،", body: "بدون دفع {amount} قبل {date} سيُحرر مقعدك لرحلة «{trip}».", buttonText: "ادفع الآن", footnote: FOOT.ar },
  },
  pre_trip_preparation: {
    fr: { subject: "Préparez votre voyage — {trip}", heading: "J-30 : on prépare", greeting: "Bonjour {name},", body: "« {trip} » part le {dates}. Pensez documents, assurance et bagages. Guide complet ci-dessous.", buttonText: "Voir le guide", footnote: FOOT.fr },
    en: { subject: "Prepare your trip — {trip}", heading: "30 days to go", greeting: "Hello {name},", body: "“{trip}” leaves on {dates}. Think documents, insurance and packing. Full guide below.", buttonText: "View guide", footnote: FOOT.en },
    es: { subject: "Prepare su viaje — {trip}", heading: "Faltan 30 días", greeting: "Hola {name},", body: "«{trip}» sale el {dates}. Prepare documentos, seguro y equipaje. Guía completa abajo.", buttonText: "Ver la guía", footnote: FOOT.es },
    ar: { subject: "جهّز رحلتك — {trip}", heading: "بقي 30 يوما", greeting: "مرحبا {name}،", body: "رحلة «{trip}» تنطلق {dates}. جهّز الوثائق والتأمين والأمتعة. الدليل الكامل أدناه.", buttonText: "عرض الدليل", footnote: FOOT.ar },
  },
  pre_trip_reminder: {
    fr: { subject: "Départ imminent — {trip}", heading: "J-7 : dernières infos", greeting: "Bonjour {name},", body: "Départ le {dates} pour « {trip} ». Lieu de rendez-vous et contacts ci-dessous.", buttonText: "Voir les infos", footnote: FOOT.fr },
    en: { subject: "Departing soon — {trip}", heading: "7 days: final info", greeting: "Hello {name},", body: "Departure on {dates} for “{trip}”. Meeting point and contacts below.", buttonText: "View info", footnote: FOOT.en },
    es: { subject: "Salida inminente — {trip}", heading: "7 días: info final", greeting: "Hola {name},", body: "Salida el {dates} para «{trip}». Punto de encuentro abajo.", buttonText: "Ver info", footnote: FOOT.es },
    ar: { subject: "المغادرة قريبة — {trip}", heading: "7 أيام: معلومات أخيرة", greeting: "مرحبا {name}،", body: "المغادرة {dates} لرحلة «{trip}». نقطة اللقاء أدناه.", buttonText: "عرض المعلومات", footnote: FOOT.ar },
  },
  post_trip_followup: {
    fr: { subject: "Merci d'avoir voyagé — {trip}", heading: "Bien rentrée ?", greeting: "Bonjour {name},", body: "Merci d'avoir partagé « {trip} ». Racontez-nous tout en répondant à cet e-mail — et à bientôt.", footnote: FOOT.fr },
    en: { subject: "Thanks for travelling — {trip}", heading: "Welcome back?", greeting: "Hello {name},", body: "Thanks for sharing “{trip}”. Tell us everything by replying — see you soon.", footnote: FOOT.en },
    es: { subject: "Gracias por viajar — {trip}", heading: "¿De vuelta?", greeting: "Hola {name},", body: "Gracias por compartir «{trip}». Cuéntenos respondiendo — hasta pronto.", footnote: FOOT.es },
    ar: { subject: "شكرا لسفرك — {trip}", heading: "عودة موفقة؟", greeting: "مرحبا {name}،", body: "شكرا لمشاركتك «{trip}». حدثنا بالرد — إلى اللقاء.", footnote: FOOT.ar },
  },
};

function fill(text: string, vars: VoyageEmailVars): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => vars[key as keyof VoyageEmailVars] ?? "");
}

const LAYOUT_FOOTNOTE = {
  fr: "Si vous n'êtes pas concernée, ignorez cet e-mail.",
  en: "If this isn't for you, please ignore this email.",
  es: "Si no es para usted, ignore este correo.",
  ar: "إذا لم تكن معنيا، تجاهل هذه الرسالة.",
} satisfies Record<Locale, string>;

export function voyageTemplate(key: VoyageEmailTemplate, locale: Locale, vars: VoyageEmailVars, url?: string) {
  const entry = T[key][locale] ?? T[key].en;
  const layout = getEmailTranslations(locale).layout;
  const section: EmailSection = {
    heading: fill(entry.heading, vars),
    greeting: fill(entry.greeting, vars),
    body: fill(entry.body, vars),
    buttonText: entry.buttonText ? fill(entry.buttonText, vars) : "",
    buttonUrl: url ?? "",
    extra: entry.extra ? fill(entry.extra, vars) : undefined,
    footnote: LAYOUT_FOOTNOTE[locale] ?? LAYOUT_FOOTNOTE.en,
  };
  return {
    subject: `${fill(entry.subject, vars)} — ATLASELLE`,
    html: renderEmailHtml(locale, layout, section),
    text: renderEmailText(locale, layout, section),
  };
}
