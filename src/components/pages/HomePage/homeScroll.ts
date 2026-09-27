/**
 * homeScroll — l'animation de la homepage suit le récit du voyage :
 * on part (héros), on trace l'itinéraire, on traverse une journée, on arrive.
 *
 * Chargé en dynamic import depuis `HomeScrollExperience.astro` : les autres
 * pages ne téléchargent jamais ce chunk. GSAP 3.15 (SplitText et DrawSVG sont
 * désormais gratuits).
 *
 * Volontairement SANS ScrollSmoother : il réécrit la position de scroll et se
 * heurte à la restauration native au refresh (la page atterrissait en bas),
 * casse les ancres et le scroll clavier. On garde le scroll natif — plus
 * robuste, plus accessible, et ~25 ko de moins.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin);
ScrollTrigger.config({ ignoreMobileResize: true });

type Cleanup = () => void;

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function initHomeScroll(): Cleanup {
  if (reduced()) return () => {};

  const splits: SplitText[] = [];
  const ctx = gsap.context(() => {
    // ── Titres découpés : chaque ligne monte d'en dessous de son masque ──────
    gsap.utils.toArray<HTMLElement>("[data-split]").forEach((el) => {
      const mode = el.dataset.split ?? "lines";
      const split = new SplitText(el, { type: mode, linesClass: "split-line" });
      splits.push(split);
      gsap.from(split[mode as "lines" | "words"], {
        yPercent: 116,
        duration: 1.15,
        ease: "expo.out",
        stagger: 0.075,
        scrollTrigger: el.closest(".home-hero")
          ? { trigger: el, start: "top 88%" }
          : { trigger: el, start: "top 85%", once: true },
      });
    });

    // ── Héros : les colonnes glissent à des vitesses différentes ────────────
    // Translation seule : la marge de 4 % donnée en CSS (`-inset-y-[4%]`) est
    // la course disponible, et le clip est porté par la colonne. Aucun `scale`
    // ici — les colonnes font 1/3 d'écran, agrandir les sources les rend floues.
    gsap.utils.toArray<HTMLElement>(".home-hero [data-depth]").forEach((img) => {
      const depth = parseFloat(img.dataset.depth ?? "0.2");
      gsap.fromTo(
        img,
        { yPercent: -3.2 * depth },
        {
          yPercent: 3.2 * depth,
          ease: "none",
          scrollTrigger: { trigger: ".home-hero", start: "top top", end: "bottom top", scrub: 0.8 },
        },
      );
    });

    const heroCopy = document.querySelector(".home-hero .home-hero-copy");
    if (heroCopy) {
      gsap.to(heroCopy, {
        yPercent: -8,
        opacity: 0.25,
        ease: "none",
        scrollTrigger: { trigger: ".home-hero", start: "60% top", end: "bottom top", scrub: 0.6 },
      });
    }

    // ── La journée : le fil se trace, la lumière passe de l'aube au soir ────
    const day = document.querySelector<HTMLElement>("[data-day-root]");
    if (day) {
      const path = day.querySelector("[data-day-progress]");
      if (path) {
        gsap.fromTo(
          path,
          { drawSVG: "0% 0%" },
          {
            drawSVG: "0% 100%",
            ease: "none",
            scrollTrigger: { trigger: day, start: "top 60%", end: "bottom 80%", scrub: 0.5 },
          },
        );
      }
      const sky = day.querySelector("[data-day-sky]");
      if (sky) {
        // Aube → lumière pleine → crépuscule. Borné entre 0.35 et 1 : le voile
        // ne doit jamais arriver à `background` plein, sinon la section
        // « déborde » de la surface portante (et l'ambiance disparaît).
        gsap
          .timeline({
            scrollTrigger: { trigger: day, start: "top bottom", end: "bottom bottom", scrub: 0.8 },
          })
          .fromTo(sky, { opacity: 0.35 }, { opacity: 1, ease: "none" })
          .to(sky, { opacity: 0.55, ease: "none" });
      }
      // Chaque moment s'allume quand la journée y arrive. Piloté par GSAP et
      // non par une classe CSS : sans JS, la journée reste entièrement lisible.
      const moments = gsap.utils.toArray<HTMLElement>("[data-day-moment]");
      moments.forEach((moment) => gsap.set(moment, { opacity: 0.3 }));
      moments.forEach((moment, index) => {
        ScrollTrigger.create({
          trigger: moment,
          start: "top 72%",
          end: "bottom 28%",
          onToggle: (self) => {
            gsap.to(moment, { opacity: self.isActive ? 1 : 0.3, duration: 0.6, overwrite: "auto" });
          },
        });
        // Le premier moment est déjà « arrivé » au chargement.
        if (index === 0) gsap.set(moment, { opacity: 1 });
      });
    }

    // ── En-têtes de chapitre ────────────────────────────────────────────────
    gsap.utils.toArray<HTMLElement>("[data-home-reveal]").forEach((el) => {
      gsap.fromTo(
        el,
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        },
      );
    });

    // ── Images en parallaxe douce (les cartes gardent leur hover) ───────────
    gsap.utils.toArray<HTMLElement>("[data-lag]").forEach((el) => {
      const lag = parseFloat(el.dataset.lag ?? "0.06");
      gsap.fromTo(
        el,
        { yPercent: -lag * 100 },
        {
          yPercent: lag * 100,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.6 },
        },
      );
    });

    // ── Compteurs ───────────────────────────────────────────────────────────
    // La valeur finale est déjà dans le HTML : sans JS le chiffre est correct,
    // GSAP ne fait que l'animer depuis zéro.
    gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
      const target = parseFloat(el.dataset.count ?? "0");
      const format = (v: number) =>
        Number.isInteger(target) ? String(Math.round(v)) : v.toFixed(1);
      const obj = { value: 0 };
      el.textContent = format(0);
      gsap.to(obj, {
        value: target,
        duration: 1.6,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 92%", once: true },
        onUpdate: () => {
          el.textContent = format(obj.value);
        },
        onComplete: () => {
          el.textContent = format(target);
        },
      });
    });
  });

  // Un seul refresh après le chargement : les images du héros et des cartes
  // changent la hauteur du document, les déclencheurs calculés trop tôt
  // seraient faux (et le refresh natif du navigateur aussi).
  ScrollTrigger.refresh();
  if (document.readyState === "complete") {
    ScrollTrigger.refresh();
  } else {
    window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
  }

  return () => {
    splits.forEach((s) => s.revert());
    splits.length = 0;
    ctx.revert();
  };
}
