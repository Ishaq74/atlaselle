# Media Upload — Upload d'images local

Upload d'images 100% local dans `public/uploads/`. Réutilisable pour avatars, logos d'organisation, et futur blog.

## Endpoint

```md
POST /api/upload
Content-Type: multipart/form-data
Authorization: session cookie (auth obligatoire)
```

### Paramètres (form-data)

| Champ  | Type   | Requis | Description          |
| ------ | ------ | ------ | -------------------- |
| `file` | File   | Oui    | image à uploader     |
| `type` | string | Oui    | `avatar`, `logo`, `site` ou `media` (`types.ts:4`) |
| `oldUrl` | string | Non | URL précédente à supprimer (même dossier de type uniquement, `api/upload.ts:58-65`) |

### Mapping type → dossier (`UPLOAD_DIRS`, `types.ts:7-12`)

| Type     | Dossier cible                    |
| -------- | -------------------------------- |
| `avatar` | `public/uploads/images/avatars/` |
| `logo`   | `public/uploads/images/logos/`   |
| `site`   | `public/uploads/images/site/`    |
| `media`  | `public/uploads/images/media/`   |

### Réponse succès (201)

```json
{ "url": "/uploads/images/avatars/a1b2c3d4-5678-90ab-cdef.jpg" }
```

### Réponses erreur

| Status | Code | Description |
| ------ | ---- | ----------- |
| 401 | — | Non authentifié |
| 400 | — | Body non multipart, champ `file` manquant, champ `type` invalide |
| 400 | `INVALID_TYPE` | Type MIME non autorisé |
| 400 | `FILE_TOO_LARGE` | Fichier trop volumineux (> 2 MB, SVG > 256 KB) |
| 400 | `EMPTY_FILE` | Fichier vide (`upload.ts:56`) |
| 400 | `INVALID_CONTENT` | Contenu réel (magic bytes) ne correspondant pas (`upload.ts:85`) |
| 400 | `INVALID_SUBDIR` | Sous-dossier invalide (`upload.ts:71`) |
| 429 | — | Rate-limit 10 requêtes / 60 s par IP (`api/upload.ts:22`) |
| 500 | — | Erreur serveur inattendue |

## Validations

### Types MIME autorisés (`types.ts:15-22`)

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/avif`
- `image/x-icon`
- `image/svg+xml`

> Seuls `jpeg/png/webp/avif/x-icon` sont validés par **magic bytes** (`MAGIC_BYTES`, `upload.ts:10-19`). `image/svg+xml` est exclu via `TEXT_BASED` (`upload.ts:22`) et suit la voie sanitize SVG. `image/vnd.microsoft.icon` n'est pas autorisé.

### Taille max

2 MB par défaut (configurable via `UploadOptions.maxSize`). SVG limité à 256 KB (`upload.ts:92`), car le parsing/sanitize SVG est coûteux en CPU. Les SVG sont sanitizés via DOMPurify (`upload.ts:101`) ; un SVG vidé par la sanitize est rejeté en `INVALID_CONTENT`.

## Nommage des fichiers

Chaque fichier reçoit un nom unique : `UUID` + extension déduite du MIME via `mimeToExt()` (`upload.ts:66-67`), pas l'extension originale.
Exemple : `f47ac10b-58cc-4372-a567-0e02b2c3d479.jpg`

Aucune collision possible, aucune information personnelle dans le nom.

Les images matricielles JPEG/PNG génèrent aussi une variante WebP via sharp (`upload.ts:117-124`, supprimée avec l'original par `deleteUpload`).

## Suppression (`delete.ts:8` `deleteUpload`)

```ts
import { deleteUpload } from '@media/delete';

await deleteUpload('/uploads/images/avatars/f47ac10b.jpg');
```

Seuls les fichiers dans `/uploads/` sont acceptés. Le path traversal est bloqué. À l'upload, `oldUrl` n'est supprimé que s'il pointe vers le même dossier de type (`api/upload.ts:58-65`) et chaque upload réussi est journalisé en audit `FILE_UPLOAD` (`api/upload.ts:68-76`).

## Utilisation côté client

```ts
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('type', 'avatar');

const res = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
  credentials: 'include', // envoie les cookies de session
});

const { url, error } = await res.json();
if (error) {
  console.error(error);
} else {
  console.log('URL:', url); // /uploads/images/avatars/uuid.jpg
}
```

## Architecture

```md
src/media/
├── types.ts    # UploadType, UploadResult, UploadOptions, constantes
├── upload.ts   # processUpload() — validation + écriture disque
└── delete.ts   # deleteUpload() — suppression par URL

src/pages/api/
└── upload.ts   # Endpoint POST /api/upload

public/uploads/
├── .gitkeep  # seul fichier versionné du dossier
└── images/
    ├── avatars/
    ├── logos/
    ├── media/
    └── site/     # logos, favicons, OG images du site
```

## Utilisation dans l'admin CMS

Usage vérifié : `src/components/pages/auth/ProfilePage.astro:224` (upload `avatar` avec `oldUrl`).
`src/components/pages/org/OrgSettingsPage.astro` N'EXISTE PLUS (dossier `org/` vidé 2026-09-14 — ne pas référencer).

La page **Admin Site** (`/[lang]/admin/site`) utilise l'upload pour 4 champs image :

| Champ | Usage | Type upload |
| :-- | :-- | :-- |
| `logoLight` | Logo clair | `site` |
| `logoDark` | Logo sombre | `site` |
| `favicon` | Favicon | `site` |
| `ogImage` | Image Open Graph | `site` |

Chaque champ affiche un aperçu de l'image actuelle + un bouton "Changer l'image" qui déclenche un `<input type="file">` caché. L'upload est envoyé en `POST /api/upload` avec `type: 'site'`, et l'URL retournée est stockée dans un champ `<input type="hidden">` qui est soumis avec le formulaire principal.

## Fichiers impliqués

- `src/media/types.ts` — Types et constantes (ALLOWED_MIME_TYPES, UPLOAD_DIRS, DEFAULT_MAX_SIZE)
- `src/media/upload.ts` — `processUpload()`, `UploadError`
- `src/media/delete.ts` — `deleteUpload()`
- `src/pages/api/upload.ts` — API route POST, auth + validation + upload
