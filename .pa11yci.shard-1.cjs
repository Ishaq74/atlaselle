// Généré par tests/a11y/run-pa11y-parallel.mjs — tranche 2/4.
// Ne pas modifier : régénéré à chaque run.
const base = require("C:\\Users\\Utilisateur\\Documents\\t3code\\atlaselle\\.pa11yci.cjs");
// Les URL sont à la racine de l'export, pas dans `defaults` : pa11y-ci lit
// `urls` comme option de premier niveau.
module.exports = { urls: [
  "http://localhost:4321/fr/a-propos",
  "http://localhost:4321/fr/auth/connexion",
  "http://localhost:4321/en/about",
  "http://localhost:4321/en/auth/sign-in",
  "http://localhost:4321/es/acerca-de",
  "http://localhost:4321/es/auth/iniciar-sesion",
  "http://localhost:4321/ar/about",
  "http://localhost:4321/ar/auth/sign-in",
  {
    "url": "http://localhost:4321/fr/auth/profil",
    "headers": {
      "Cookie": "better-auth.session_token=4XnN6EixdibfkQEFSbrBXOk4WY9DwIc2.afZTMXKCQW2ihmumorKiGC0H8GvOHrznArYTdFuvNuU%3D"
    }
  },
  {
    "url": "http://localhost:4321/es/auth/perfil",
    "headers": {
      "Cookie": "better-auth.session_token=4XnN6EixdibfkQEFSbrBXOk4WY9DwIc2.afZTMXKCQW2ihmumorKiGC0H8GvOHrznArYTdFuvNuU%3D"
    }
  },
  {
    "url": "http://localhost:4321/fr/admin/audit",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/fr/admin/navigation",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/fr/admin/blog",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/fr/admin/reservations",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/fr/admin/policies",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/en/admin/roles",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/en/admin/pages",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/en/admin/trips",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/en/admin/travelers",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/es/admin/audit",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/es/admin/navigation",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/es/admin/blog",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/es/admin/reservations",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/es/admin/policies",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/ar/admin/roles",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/ar/admin/pages",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/ar/admin/trips",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/ar/admin/travelers",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  }
], defaults: base.defaults };
