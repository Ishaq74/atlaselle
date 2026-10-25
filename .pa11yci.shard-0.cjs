// Généré par tests/a11y/run-pa11y-parallel.mjs — tranche 1/4.
// Ne pas modifier : régénéré à chaque run.
const base = require("C:\\Users\\Utilisateur\\Documents\\t3code\\atlaselle\\.pa11yci.cjs");
// Les URL sont à la racine de l'export, pas dans `defaults` : pa11y-ci lit
// `urls` comme option de premier niveau.
module.exports = { urls: [
  "http://localhost:4321/fr/",
  "http://localhost:4321/fr/blog",
  "http://localhost:4321/en/",
  "http://localhost:4321/en/blog",
  "http://localhost:4321/es/",
  "http://localhost:4321/es/blog",
  "http://localhost:4321/ar/",
  "http://localhost:4321/ar/blog",
  {
    "url": "http://localhost:4321/fr/auth/tableau-de-bord",
    "headers": {
      "Cookie": "better-auth.session_token=4XnN6EixdibfkQEFSbrBXOk4WY9DwIc2.afZTMXKCQW2ihmumorKiGC0H8GvOHrznArYTdFuvNuU%3D"
    }
  },
  {
    "url": "http://localhost:4321/es/auth/panel",
    "headers": {
      "Cookie": "better-auth.session_token=4XnN6EixdibfkQEFSbrBXOk4WY9DwIc2.afZTMXKCQW2ihmumorKiGC0H8GvOHrznArYTdFuvNuU%3D"
    }
  },
  {
    "url": "http://localhost:4321/fr/admin/stats",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/fr/admin/site",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/fr/admin/media",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/fr/admin/applications",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/fr/admin/emails",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/en/admin/users",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/en/admin/theme",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/en/admin/services",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/en/admin/payments",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/es/admin/stats",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/es/admin/site",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/es/admin/media",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/es/admin/applications",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/es/admin/emails",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/ar/admin/users",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/ar/admin/theme",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/ar/admin/services",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  },
  {
    "url": "http://localhost:4321/ar/admin/payments",
    "headers": {
      "Cookie": "better-auth.session_token=zsIi12qqslI3QbjQWXNv9IemYH9nZH0E.8v5xF36uHUdNYNtkvyABqZeI43X%2FTK4ZrAoNtBiuvic%3D"
    }
  }
], defaults: base.defaults };
