import "server-only";
import { registerProfileCollector } from "./index";
import { instagramProfileCollector } from "./instagram";
import { youtubeProfileCollector } from "./youtube";
import { vendorCollectors } from "./vendor";

/**
 * Import this once before using the registry. Vendors register first so the
 * platform-native adapters take precedence where both are configured — a
 * first-party number beats a resold one.
 */
let registered = false;

export function registerAllProfileCollectors() {
  if (registered) return;
  for (const collector of vendorCollectors) registerProfileCollector(collector);
  registerProfileCollector(instagramProfileCollector);
  registerProfileCollector(youtubeProfileCollector);
  registered = true;
}
