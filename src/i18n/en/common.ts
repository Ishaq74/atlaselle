import type { CommonTranslations } from '../config';

export default {
  meta: {
    title: 'ATLASELLE — Small-group cultural journeys',
    description: 'Thoughtfully shaped small-group journeys across Africa and the Mediterranean.',
  },
  pageRoutes: {
    about: 'about',
    contact: 'contact',
    legal: 'legal-notice',
  },
  nav: {
    features: 'Features',
    analytics: 'Analytics',
    integrations: 'Integrations',
    team: 'Team',
    about: 'About',
    contact: 'Contact',
  },
  cta: {
    getStarted: 'Get Started',
    signIn: 'Sign In',
  },
  footer: {
    socialHeading: 'Social Media',
    navPrimary: 'Main Navigation',
    navSecondary: 'Secondary Navigation',
    legalHeading: 'Legal',
    copyright: '© 2026 — All rights reserved',
    home: 'Home',
    aboutLink: 'About',
    contact: 'Contact',
    legalNotice: 'Legal Notice',
    privacyPolicy: 'Privacy Policy',
    termsOfSale: 'Terms of Sale',
  },
  a11y: {
    openMenu: 'Open menu',
    switchLanguage: 'Switch language',
    skipToContent: 'Skip to main content',
  },
  errors: {
    notFound: {
      title: 'Page not found',
      heading: 'Page Not Found',
      message: 'The page you are looking for does not exist or has been moved.',
      back: 'Back to home',
    },
    serverError: {
      title: 'Server Error',
      heading: 'Internal Server Error',
      message: 'Something went wrong. Please try again later.',
      back: 'Back to home',
    },
  },
  rss: {
    title: 'ATLASELLE — RSS Feed',
    description: 'Latest journeys and stories from ATLASELLE',
  },
} satisfies CommonTranslations;
