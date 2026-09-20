import { DEFAULT_LIGHT_TOKENS, DEFAULT_DARK_TOKENS } from '@/lib/theme-tokens';

// Theme settings — identité visuelle Atlaselle (terracotta désert / bleu oasis).
// Tokens complets light + dark via lib/theme-tokens (source de vérité CSS).
export default [
  {
    name: "default",
    isActive: true,
    lightTokens: JSON.stringify(DEFAULT_LIGHT_TOKENS),
    darkTokens: JSON.stringify(DEFAULT_DARK_TOKENS),
    primaryColor: "oklch(0.880 0.200 68)", // Terracotta sable — CTA, accents chauds
    secondaryColor: "oklch(0.922 0.012 75)", // Beige lin — surfaces douces
    accentColor: "oklch(0.962 0.008 78)", // Crème désert — hover, subtil
    backgroundColor: "oklch(1 0 0)", // Blanc pur
    foregroundColor: "oklch(0.148 0.018 75)", // Encre chaude (presque noir, teinte bois)
    mutedColor: "oklch(0.962 0.008 78)", // Gris-beige désactivé
    mutedForegroundColor: "oklch(0.400 0.016 75)", // Texte secondaire chaud
    fontHeading: "'Playfair Display', Georgia, serif", // Titres élégants
    fontBody: "'Inter', system-ui, sans-serif", // Corps de texte lisible
    borderRadius: "0.75rem", // Arrondi généreux, chaleureux
  },
];
