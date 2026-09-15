-- AR legal page slug ASCII (convention routes.ts).
UPDATE pages SET slug = 'legal-notice', updated_at = now() WHERE locale = 'ar' AND slug = 'الشروط-القانونية';
