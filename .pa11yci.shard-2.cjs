// Généré par tests/a11y/run-pa11y-parallel.mjs — tranche 3/4.
// Ne pas modifier : régénéré à chaque run.
const base = require("C:\\Users\\Utilisateur\\Documents\\t3code\\atlaselle\\.pa11yci.cjs");
// Les URL sont à la racine de l'export, pas dans `defaults` : pa11y-ci lit
// `urls` comme option de premier niveau.
module.exports = { urls: [
  "http://localhost:4321/fr/contact",
  "http://localhost:4321/fr/auth/inscription",
  "http://localhost:4321/en/contact",
  "http://localhost:4321/en/auth/sign-up",
  "http://localhost:4321/es/contacto",
  "http://localhost:4321/es/auth/registro",
  "http://localhost:4321/ar/contact",
  "http://localhost:4321/ar/auth/sign-up",
  {
    "url": "http://localhost:4321/en/auth/dashboard",
    "headers": {
      "Cookie": "better-auth.session_token=4XnN6EixdibfkQEFSbrBXOk4WY9DwIc2.afZTMXKCQW2ihmumorKiGC0H8GvOHrznArYTdFuvNuU%3D"
    }
  },
  {
    "url": "http://localhost:4321/ar/auth/dashboard",
    "headers": {
      "Cookie": "better-auth.session_token=4XnN6EixdibfkQEFSbrBXOk4WY9DwIc2.afZTMXKCQW2ihmumorKiGC0H8GvOHrznArYTdFuvNuU%3D"
    }
  },
  {
    "url": "http://localhost:4321/fr/admin/users",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/fr/admin/theme",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/fr/admin/services",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/fr/admin/payments",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/en/admin/stats",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/en/admin/site",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/en/admin/media",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/en/admin/applications",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/en/admin/emails",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/es/admin/users",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/es/admin/theme",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/es/admin/services",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/es/admin/payments",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/ar/admin/stats",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/ar/admin/site",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/ar/admin/media",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/ar/admin/applications",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/ar/admin/emails",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  }
], defaults: base.defaults };
