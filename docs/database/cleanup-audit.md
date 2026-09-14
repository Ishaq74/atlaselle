# db:cleanup-audit — Purge des logs d'audit

> **Commande** : `pnpm db:cleanup-audit`  
> **Fichier** : `src/database/commands/db.cleanup-audit.ts`

---

## Usage

```bash
# Rétention par défaut (90 jours)
pnpm db:cleanup-audit

# Rétention personnalisée
AUDIT_RETENTION_DAYS=30 pnpm db:cleanup-audit
```

---

## Fonctionnement

Supprime les entrées de la table `audit_log` dont `created_at` est antérieur à N jours.

### Paramètres

| Variable | Défaut | Description |
| :-- | :-- | :-- |
| `AUDIT_RETENTION_DAYS` | `90` | Nombre de jours de rétention (minimum 1) |

### Sortie

```text
═══════════════════════════════════════════════════════
   🧹 Cleanup Audit Logs — LOCAL (rétention : 90j)
═══════════════════════════════════════════════════════

[cible] LOCAL (postgresql://localhost:5432/atlaselle_dev)

✔️  247 entrée(s) supprimée(s) (> 90 jours).
```

---

## Protection

- Confirmation **uniquement en production** via `confirmProd()` — aucune confirmation en LOCAL/TEST
- Suppression par batch de 1000 : `DELETE FROM audit_log WHERE id IN (SELECT id FROM audit_log WHERE created_at < NOW() - INTERVAL '1 day' * $1 LIMIT $2)` (boucle jusqu'à épuisement)

---

## Planification recommandée

Pour un nettoyage régulier, ajouter un cron job :

```bash
# Chaque dimanche à 3h du matin
0 3 * * 0 cd /path/to/atlaselle && AUDIT_RETENTION_DAYS=90 pnpm db:cleanup-audit
```

---

## Voir aussi

- [../audit.md](../audit.md) — Documentation complète du système d'audit
