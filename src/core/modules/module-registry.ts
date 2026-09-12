import type { AtlaselleModuleDefinition } from "./module-contract";

const modules = new Map<string, AtlaselleModuleDefinition>();

export function registerModule(module: AtlaselleModuleDefinition): void {
  if (modules.has(module.id)) throw new Error(`Atlaselle module already registered: ${module.id}`);
  modules.set(module.id, module);
}

export function getModule(id: string): AtlaselleModuleDefinition | undefined {
  return modules.get(id);
}

export function listModules(): readonly AtlaselleModuleDefinition[] {
  return [...modules.values()];
}

export function clearModuleRegistryForTests(): void {
  modules.clear();
}
