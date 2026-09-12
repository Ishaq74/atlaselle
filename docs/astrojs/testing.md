# Vitest et l’API des conteneurs

Vous pouvez tester nativement les composants Astro en utilisant l’API des conteneurs. Tout d’abord, configurez vitest comme expliqué ci-dessus, puis créez un fichier .test.js pour tester votre composant :

example.test.js
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { expect, test } from 'vitest';
import Card from '../src/components/Card.astro';

test('Carte avec des slots', async () => {
  const container = await AstroContainer.create();
  const result = await container.renderToString(Card, {
    slots: {
      default: 'Contenu de la carte',
    },
  });

  expect(result).toContain('Ceci est une carte');
  expect(result).toContain('Contenu de la carte');
});

Exécution des tests Playwright
Vous pouvez exécuter un seul test ou plusieurs tests à la fois, en testant un ou plusieurs navigateurs. Par défaut, les résultats de vos tests s’affichent dans le terminal. En option, vous pouvez ouvrir le rapporteur de test HTML pour afficher un rapport complet et filtrer les résultats des tests.

Pour exécuter le test de l’exemple précédent en ligne de commande, utilisez la commande test. Si vous le souhaitez, vous pouvez inclure le nom du fichier pour n’exécuter qu’un seul test :

Fenêtre du terminal
npx playwright test index.spec.ts

Pour voir le rapport de test HTML complet, ouvrez-le à l’aide de la commande suivante :

Fenêtre du terminal
npx playwright show-report

Astuce

Exécutez vos tests par rapport à votre code de production pour qu’ils ressemblent davantage à votre site réel et déployé.

Avancé : Lancement d’un serveur web de développement pendant les tests
Vous pouvez également demander à Playwright de démarrer votre serveur lorsque vous exécutez votre script de test en utilisant l’option webServer dans le fichier de configuration de Playwright.
