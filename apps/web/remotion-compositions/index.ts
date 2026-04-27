// @ts-nocheck — bundled by @remotion/bundler (webpack), not tsc.
/**
 * Remotion entry point — registers all server-side render compositions.
 *
 * This file is bundled by @remotion/bundler at render time.
 * It must be the only registerRoot() call in the project.
 */
import { registerRoot } from "remotion";
import { ClipExportRoot } from "./ClipExportComposition";

registerRoot(ClipExportRoot);
