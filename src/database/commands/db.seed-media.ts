/**
 * db.seed-media — Synchronise src/assets/images/trips/* vers public/uploads/
 * puis indexe tous les fichiers existants into media_folders + media_files.
 *
 * Run: pnpm db:seed-media
 *
 * Safe to run multiple times — skips files already in DB (by url).
 * Invariant voyage : 26 fichiers 5 dossiers alignés aux trips (00b).
 */
import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, extname, relative, dirname } from 'node:path';
import { getDrizzle, shutdownDb } from '../drizzle';
import {
  mediaFolders,
  mediaFiles,
  mediaFileAlts,
  blogPostGalleryMedia,
  blogPostGalleryMediaCaptions,
  tripMedia,
  tripMediaCaptions,
  trips,
} from '../schemas';
import { LOCALES, type Locale } from '../../i18n/config';
import { eq, and, ne, asc, isNotNull } from 'drizzle-orm';
import { c, logTarget, confirmProd } from './_utils';

// ─── MIME detection from extension ───────────────────────────────────
const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

function mimeFromExt(filename: string): string | null {
  const ext = extname(filename).toLowerCase();
  return EXT_TO_MIME[ext] ?? null;
}

// ─── Recursive scan ──────────────────────────────────────────────────
interface ScanResult {
  relativePath: string; // e.g. "images/site/photo.jpg"
  filename: string;
  size: number;
  mimeType: string;
  subfolder: string | null; // e.g. "images/site" or null if root
}

function scanUploads(baseDir: string, currentDir: string = baseDir): ScanResult[] {
  const results: ScanResult[] = [];
  let entries: string[];
  try {
    entries = readdirSync(currentDir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = join(currentDir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...scanUploads(baseDir, fullPath));
    } else if (stat.isFile()) {
      if (entry === '.gitkeep') continue;

      const mime = mimeFromExt(entry);
      if (!mime) continue; // Skip non-image files (e.g. .webp companions handled separately)

      // Skip .webp companion files (they are auto-generated)
      if (extname(entry).toLowerCase() === '.webp') {
        const baseName = entry.replace(/\.webp$/, '');
        // Check if a source file (jpg/png) exists alongside
        const hasSource = entries.some(e =>
          e !== entry && e.startsWith(baseName) && ['.jpg', '.jpeg', '.png'].includes(extname(e).toLowerCase())
        );
        if (hasSource) continue;
      }

      const relPath = relative(baseDir, fullPath).replace(/\\/g, '/');
      const relDir = relative(baseDir, currentDir).replace(/\\/g, '/');

      results.push({
        relativePath: relPath,
        filename: entry,
        size: stat.size,
        mimeType: mime,
        subfolder: relDir || null,
      });
    }
  }

  return results;
}

// ─── Main ────────────────────────────────────────────────────────────

/**
 * Mapping: disk subfolder path → logical folder name
 * - images/avatars → Avatars
 * - images/logos, images/brand → Brand
 * - media/trips/* → Voyages (dossier parent, enfants créés via seed 00)
 * - everything else (images/site, images/test, media, ...) → Médias
 */
/**
 * Légende par défaut d'une photo de voyage, par locale.
 *
 * Les textes alternatifs sont déjà rédigés par locale dans `media_file_alts`
 * (« Remparts de Mdina à Malte », « Ramparts of Mdina, Malta »). On s'en sert
 * comme légende : le nom de fichier (« Mdina - MALTA ») est une étiquette
 * technique, pas une description, et la légende suit alors la langue affichée.
 */
async function describeTripMedia(
  db: ReturnType<typeof getDrizzle>,
  mediaId: string,
  filename: string,
): Promise<{ alt: string; captions: { locale: Locale; caption: string }[] }> {
  const alts = await db
    .select({ locale: mediaFileAlts.locale, alt: mediaFileAlts.alt })
    .from(mediaFileAlts)
    .where(eq(mediaFileAlts.fileId, mediaId));
  const fallback = filename.replace(/\.[a-z0-9]+$/i, '').trim() || 'Photographie du voyage';
  const forLocale = (target: Locale) =>
    alts.find((a) => a.locale === target)?.alt?.trim() || fallback;
  return {
    alt: forLocale('fr'),
    captions: LOCALES.map((locale) => ({ locale, caption: forLocale(locale) })),
  };
}

function resolveFolder(subfolder: string | null): string {  if (!subfolder) return 'Médias';
  if (subfolder === 'images/avatars') return 'Avatars';
  if (subfolder === 'images/logos' || subfolder === 'images/brand') return 'Brand';
  if (subfolder.startsWith('media/trips')) return 'Voyages';
  return 'Médias';
}

// ─── Sync src/assets/images/trips/* → public/uploads/media/trips/* ─────────
// Source de vérité : 26 fichiers 5 dossiers (algeria, andalusiamorocco, bosnia,
// maltasicily, silkroad). Copie idempotente (skip si même taille).
function syncTripAssets(): { copied: number; skipped: number } {
  const srcBase = join(process.cwd(), 'src', 'assets', 'images', 'trips');
  const dstBase = join(process.cwd(), 'public', 'uploads', 'media', 'trips');
  let copied = 0;
  let skipped = 0;
  const walk = (srcDir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(srcDir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const srcPath = join(srcDir, entry);
      const stat = statSync(srcPath);
      if (stat.isDirectory()) {
        walk(srcPath);
      } else if (stat.isFile()) {
        if (entry === '.gitkeep') continue;
        const rel = relative(srcBase, srcPath).replace(/\\/g, '/');
        const dstPath = join(dstBase, rel);
        mkdirSync(dirname(dstPath), { recursive: true });
        if (existsSync(dstPath) && statSync(dstPath).size === stat.size) {
          skipped++;
          continue;
        }
        copyFileSync(srcPath, dstPath);
        copied++;
      }
    }
  };
  walk(srcBase);
  return { copied, skipped };
}

async function seedMedia() {
  console.log(c.cyan(c.bold(`\n═══════════════════════════════════════════════════════`)));
  console.log(c.cyan(c.bold(`   📸 Seed Media — Indexation des fichiers existants`)));
  console.log(c.cyan(c.bold(`═══════════════════════════════════════════════════════\n`)));

  logTarget();
  await confirmProd('seed-media');

  const uploadsDir = join(process.cwd(), 'public', 'uploads');
  const synced = syncTripAssets();
  console.log(`\n${c.cyan(`[sync]`)} src/assets/images/trips → public/uploads/media/trips : ${synced.copied} copié(s), ${synced.skipped} déjà à jour\n`);
  const scanned = scanUploads(uploadsDir);

  console.log(`\n${c.cyan(`[scan]`)} ${scanned.length} fichiers trouvés dans public/uploads/\n`);

  if (scanned.length === 0) {
    console.log(c.yellow('Aucun fichier à indexer.'));
    await shutdownDb();
    process.exit(0);
  }

  const db = getDrizzle();

  // 1. Create the logical folders: Avatars, Brand, Médias, Voyages (+ 5 enfants voyage)
  const FOLDER_NAMES = ['Avatars', 'Brand', 'Médias', 'Voyages'] as const;
  const folderMap = new Map<string, string>(); // name → id
  let foldersCreated = 0;

  for (const name of FOLDER_NAMES) {
    const [existing] = await db
      .select({ id: mediaFolders.id })
      .from(mediaFolders)
      .where(eq(mediaFolders.name, name))
      .limit(1);

    if (existing) {
      folderMap.set(name, existing.id);
      console.log(`  ${c.dim('↩')} Dossier existant: ${name}`);
    } else {
      const [created] = await db
        .insert(mediaFolders)
        .values({ name })
        .returning({ id: mediaFolders.id });
      folderMap.set(name, created.id);
      foldersCreated++;
      console.log(`  ${c.green('✔')} Dossier créé: ${name}`);
    }
  }

  console.log('');

  // 2. Insert files, mapping disk paths to logical folders
  let filesCreated = 0;
  let filesSkipped = 0;

  for (const file of scanned) {
    const url = `/uploads/${file.relativePath}`;

    // Check if already indexed
    const [existing] = await db
      .select({ id: mediaFiles.id })
      .from(mediaFiles)
      .where(eq(mediaFiles.url, url))
      .limit(1);

    if (existing) {
      filesSkipped++;
      continue;
    }

    const folderName = resolveFolder(file.subfolder);
    const folderId = folderMap.get(folderName) ?? null;

    // Try to get dimensions via sharp
    let width: number | null = null;
    let height: number | null = null;
    const RASTER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
    if (RASTER_TYPES.has(file.mimeType)) {
      try {
        const sharp = (await import('sharp')).default;
        const fullPath = join(uploadsDir, file.relativePath);
        const metadata = await sharp(fullPath).metadata();
        width = metadata.width ?? null;
        height = metadata.height ?? null;
      } catch {
        // Non-blocking
      }
    }

    await db.insert(mediaFiles).values({
      folderId,
      filename: file.filename,
      url,
      mimeType: file.mimeType,
      size: file.size,
      width,
      height,
    });

    filesCreated++;
    const dims = width && height ? ` (${width}×${height})` : '';
    console.log(`  ${c.green('✔')} ${file.relativePath}${dims}`);
  }

  console.log(`\n${c.cyan(c.bold(`═══════════════════════════════════════════════════════`))}`);
  console.log(`  ${c.green(`${foldersCreated} dossier${foldersCreated !== 1 ? 's' : ''} créé${foldersCreated !== 1 ? 's' : ''}`)}`);
  console.log(`  ${c.green(`${filesCreated} fichier${filesCreated !== 1 ? 's' : ''} indexé${filesCreated !== 1 ? 's' : ''}`)}`);
  if (filesSkipped > 0) {
    console.log(`  ${c.dim(`${filesSkipped} fichier${filesSkipped !== 1 ? 's' : ''} déjà indexé${filesSkipped !== 1 ? 's' : ''} (ignoré${filesSkipped !== 1 ? 's' : ''})`)}`);
  }
  console.log(c.cyan(c.bold(`═══════════════════════════════════════════════════════\n`)));

  // ── 3. Lien voyage → galerie (trip_media) ──────────────────────────────
  // Le dossier d'un voyage est déduit de l'emplacement de sa couverture : pas
  // de table de correspondance « dossier → voyage » à maintenir, donc aucune
  // dérive possible quand un sous-dossier est ajouté.
  const tripRows = await db
    .select({ id: trips.id, heroMediaId: trips.heroMediaId })
    .from(trips)
    .where(isNotNull(trips.heroMediaId));

  let linksCreated = 0;
  let linksSkipped = 0;

  for (const trip of tripRows) {
    if (!trip.heroMediaId) continue;
    const [hero] = await db
      .select({ folderId: mediaFiles.folderId })
      .from(mediaFiles)
      .where(eq(mediaFiles.id, trip.heroMediaId))
      .limit(1);
    if (!hero?.folderId) continue;

    // Même dossier que la couverture ⇒ même voyage. La couverture est exclue :
    // elle est déjà en en-tête de fiche, la répéter serait redondant.
    const siblings = await db
      .select({ id: mediaFiles.id, filename: mediaFiles.filename, mimeType: mediaFiles.mimeType })
      .from(mediaFiles)
      .where(and(eq(mediaFiles.folderId, hero.folderId), ne(mediaFiles.id, trip.heroMediaId)))
      .orderBy(asc(mediaFiles.filename));

    const raster = siblings.filter((file) => file.mimeType.startsWith('image/'));
    if (raster.length === 0) continue;

    const [linked] = await db
      .select({ mediaId: tripMedia.mediaId })
      .from(tripMedia)
      .where(eq(tripMedia.tripId, trip.id))
      .limit(1);
    if (linked) {
      linksSkipped++;
      // Première passe : on remplit la colonne de repli et les 4 légendes
      // localisées, sans écraser une alt éventuellement corrigée à la main.
      for (const file of raster) {
        const described = await describeTripMedia(db, file.id, file.filename);
        await db
          .update(tripMedia)
          .set({ caption: described.captions.find((c) => c.locale === 'fr')?.caption ?? described.alt })
          .where(and(eq(tripMedia.tripId, trip.id), eq(tripMedia.mediaId, file.id)));
        await db
          .insert(tripMediaCaptions)
          .values(
            described.captions.map((entry) => ({
              tripId: trip.id,
              mediaId: file.id,
              locale: entry.locale,
              caption: entry.caption,
            })),
          )
          .onConflictDoNothing();
      }
      continue;
    }

    await db.insert(tripMedia).values(
      await Promise.all(
        raster.map(async (file, index) => {
          const described = await describeTripMedia(db, file.id, file.filename);
          return {
            tripId: trip.id,
            mediaId: file.id,
            kind: "GALLERY" as const,
            // L'alt est résolu par locale à la lecture (media_file_alts) ; la
            // valeur ici n'est qu'un filet si cette locale n'existe pas.
            altText: described.alt,
            caption: described.captions.find((c) => c.locale === 'fr')?.caption ?? described.alt,
            sortOrder: index,
          };
        }),
      ),
    );

    // Légendes localisées, alignées sur les alts déjà rédigés.
    for (const file of raster) {
      const described = await describeTripMedia(db, file.id, file.filename);
      await db
        .insert(tripMediaCaptions)
        .values(
          described.captions.map((entry) => ({
            tripId: trip.id,
            mediaId: file.id,
            locale: entry.locale,
            caption: entry.caption,
          })),
        )
        .onConflictDoNothing();
    }
    linksCreated += raster.length;
    console.log(`  ${c.green("✔")} ${raster.length} image(s) → galerie du voyage ${trip.id.slice(0, 8)}`);
  }

  if (linksCreated > 0 || linksSkipped > 0) {
    console.log(`\n${c.cyan(c.bold(`═══════════════════════════════════════════════════════`))}`);
    console.log(`  ${c.green(`${linksCreated} image(s) liée(s) à une galerie`)}`);
    if (linksSkipped > 0) {
      console.log(`  ${c.dim(`${linksSkipped} voyage(s) déjà doté${linksSkipped !== 1 ? "s" : ""} d'une galerie (ignoré${linksSkipped !== 1 ? "s" : ""})`)}`);
    }
    console.log(c.cyan(c.bold(`═══════════════════════════════════════════════════════\n`)));
  }

  // ── 4. Légendes de galerie du blog, localisées ──────────────────────────
  // Même défaut que les voyages avant cette étape : `caption` restait dans la
  // langue de saisie sur les 4 locales. On rattache chaque légende existante
  // aux alts par locale du même média.
  const blogGalleries = await db
    .select({ galleryId: blogPostGalleryMedia.galleryId, mediaId: blogPostGalleryMedia.mediaId })
    .from(blogPostGalleryMedia);

  let blogCaptions = 0;
  for (const item of blogGalleries) {
    const described = await describeTripMedia(db, item.mediaId, item.mediaId);
    const inserted = await db
      .insert(blogPostGalleryMediaCaptions)
      .values(
        described.captions.map((entry) => ({
          galleryId: item.galleryId,
          mediaId: item.mediaId,
          locale: entry.locale,
          caption: entry.caption,
        })),
      )
      .onConflictDoNothing()
      .returning({ locale: blogPostGalleryMediaCaptions.locale });
    blogCaptions += inserted.length;
  }

  if (blogCaptions > 0) {
    console.log(`  ${c.green(`✔ ${blogCaptions} légende(s) de galerie blog localisée(s)`)}\n`);
  }

  await shutdownDb();
}

seedMedia().catch((err) => {
  console.error(c.red(`[ERREUR] ${err.message}`));
  process.exit(1);
});
