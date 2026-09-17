import { purgeVoyageTestFixtures } from "./voyage";

export default async function voyageGlobalSetup(): Promise<void> {
  await purgeVoyageTestFixtures();
}
