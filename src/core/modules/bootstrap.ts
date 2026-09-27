import { registerModule } from "./module-registry";
import { blogModule } from "@/modules/blog/module";
import { servicesModule } from "@/modules/services/module";
import { registerInternalLinkResolver } from "@/lib/content/internal-link-resolver";
import { blogInternalLinkResolver } from "@/lib/blog/blog-internal-link";
import { serviceInternalLinkResolver } from "@/lib/services/services-internal-link";
import { registerSearchResource } from "@/core/search/registry";

let bootstrapped = false;

/**
 * Le garde doit survivre à la ré-évaluation des modules par le serveur de dev.
 * Vite ré-instancie `bootstrap.ts` (et son `bootstrapped`) lors d'un HMR, mais
 * `module-registry.ts` peut conserver sa Map : sans contre-garde sur
 * `globalThis`, `registerModule` levait « already registered » à la requête
 * suivante. Les deux cas sont couverts : registre neuf → l'enregistrement
 * passe, registre conservé → la contre-garde arrête l'appel.
 */
const GLOBAL_FLAG = "__atlaselleModulesBootstrapped";

export function bootstrapModules(): void {
  const globalScope = globalThis as Record<string, unknown>;
  if (bootstrapped || globalScope[GLOBAL_FLAG] === true) return;
  registerModule(blogModule);
  registerModule(servicesModule);
  if (blogModule.searchDefinition) registerSearchResource(blogModule.searchDefinition);
  if (servicesModule.searchDefinition) registerSearchResource(servicesModule.searchDefinition);
  registerInternalLinkResolver(blogInternalLinkResolver);
  registerInternalLinkResolver(serviceInternalLinkResolver);
  bootstrapped = true;
  globalScope[GLOBAL_FLAG] = true;
}