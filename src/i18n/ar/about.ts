import type { AboutTranslations } from '../config';
import { stone, bronze, houseCivilization, polish } from '../../assets/images/brand';
import { avatar1 } from '../../assets/images/avatars';

export default {
  meta: {
    title: 'من نحن – Atlaselle',
    description: 'أطلسيل تصمم رحلات بمجموعات صغيرة للنساء، بين المدن العتيقة والصحارى والجزر. اكتشفي قصتنا ومؤسِّستنا.',
  },
  hero: {
    eyebrow: 'قصتنا',
    title: 'رحلات مصممة كأنها لقاءات',
    description: 'وُلدت أطلسيل من ملاحظة بسيطة: كثير من النساء يتنازلن عن السفر لغياب إطار يطمئنّ إليه. نصمم رحلات بمجموعات صغيرة — من ست إلى أربع عشرة مسافرة — بين المدن العتيقة والصحارى وجزر المتوسط، مع وقت حقيقي لأن تحييي المكان فعلاً.',
  },
  mission: {
    eyebrow: 'سبب وجودنا',
    title: 'المهمة والرؤية',
    description: 'ركيزتان توجهان كل مساراتنا.',
    cards: [
      {
        icon: 'mdi:target',
        title: 'مهمتنا',
        description: 'أن نتيح لكل امرأة السفر بطمأنينة، وحدها دون أن تكون معزولة: مجموعات صغيرة تُبنى بعناية، وإقامات مختارة في الميدان، ومرشدات محليات، وإيقاع يحترم كل واحدة.',
      },
      {
        icon: 'mdi:eye-outline',
        title: 'رؤيتنا',
        description: 'سفر يترك أثراً إيجابياً: للمسافرات اللواتي يعدن متحولات، وللمجتمعات التي تستضيفنا — الحرفيون وبيوت الضيافة والموائد المحلية أولاً.',
      },
    ],
  },
  values: {
    eyebrow: 'ما يميزنا',
    title: 'قيمنا',
    description: 'المبادئ التي توجه أطلسيل كل يوم.',
    items: [
      {
        title: 'العناية',
        description: 'كل مسار يُختبر في الميدان. إيقاع هادئ، واستراحات حقيقية، وأوقات هادئة كل يوم: يجب أن يبقى السفر متعة، لا سباقاً.',
        image: stone,
        value: 'care',
      },
      {
        title: 'الثقة',
        description: 'أسعار شفافة بنداً ببند، وشروط إلغاء واضحة، وتأمين مشروح بلا تعقيد. لا رسوم خفية ولا مفاجآت.',
        image: bronze,
        value: 'trust',
      },
      {
        title: 'اللقاء',
        description: 'نفضّل العناوين المحلية: بيوت الضيافة وورش الحرفيين والموائد العائلية. فالرحلة تبدأ بمن يستضيفوننا.',
        image: houseCivilization,
        value: 'encounter',
      },
      {
        title: 'الاحترام',
        description: 'للكوكب وللثقافات ولإيقاعك الداخلي. أماكن صلاة محددة، وبرامج مكيّفة خلال رمضان، ومجموعات صغيرة للحد من بصمتنا.',
        image: polish,
        value: 'respect',
      },
    ],
  },
  team: {
    eyebrow: 'المؤسِّسة',
    title: 'من تقف وراء أطلسيل',
    description: 'أطلسيل شركة بمقياس إنساني: شخص واحد يصمم كل رحلة ويختبرها ويرافقها.',
    members: [
      {
        name: 'أمهاني عاشور',
        role: 'المؤسِّسة ومصممة الرحلات',
        bio: 'مسافرة ميدانية، طافت أمهاني بالجزائر والمغرب والأندلس والبوسنة وطريق الحرير قبل أن تحولها إلى مسارات. وهي تجيب شخصياً على كل طلب.',
        image: avatar1,
        socials: [
          { name: 'LinkedIn', icon: 'linkedin', href: 'https://linkedin.com/in/oumhani-achour' },
          { name: 'Instagram', icon: 'instagram', href: 'https://instagram.com/atlaselle.voyages' },
          { name: 'Email', icon: 'mail', href: 'mailto:contact@atlaselle.com' },
        ],
      },
    ],
  },
  cta: {
    title: 'مستعدة لرحلتك القادمة؟',
    description: 'تصفحي وجهاتنا أو راسلينا مباشرة: كل رحلة تبدأ بمحادثة.',
    primaryButton: { text: 'شاهدي الرحلات', href: '/ar/trips' },
    secondaryButton: { text: 'اتصلي بنا', href: '/ar/contact' },
  },
} satisfies AboutTranslations;
