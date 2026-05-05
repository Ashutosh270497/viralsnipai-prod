import { readFileSync } from "fs";
import path from "path";

const root = process.cwd();

const activePipelineFiles = [
  "lib/application/use-cases/GenerateAutoHighlightsUseCase.ts",
  "app/api/repurpose/auto-highlights/route.ts",
  "lib/domain/services/TranscriptionService.ts",
  "lib/domain/services/ClipCandidateGenerationService.ts",
  "lib/domain/services/ClipRerankingService.ts",
  "lib/domain/services/ClipBoundaryRefinementService.ts",
  "lib/services/virality.service.ts",
  "lib/ai/providers/openrouter-reasoning-provider.ts",
  "lib/ai/providers/openai-transcription-provider.ts",
  "lib/ai/providers/openai-transcription-client.ts",
  "lib/ai/provider-policy.ts",
];

const failures: string[] = [];

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function fail(message: string) {
  failures.push(message);
}

const useCase = read("lib/application/use-cases/GenerateAutoHighlightsUseCase.ts");
for (const token of ["startPercent", "endPercent", "start_percent", "end_percent"]) {
  if (useCase.includes(token)) {
    fail(`Active V1 auto-highlights use case must not contain ${token}.`);
  }
}

if (/generateHighlights\s*\(/.test(useCase)) {
  fail("Active V1 auto-highlights use case must not call legacy generateHighlights().");
}

if (/extractClips\s*\(/.test(useCase)) {
  fail("Active V1 auto-highlights use case must not call legacy percentage extractClips().");
}

const boundaryRefinement = read("lib/domain/services/ClipBoundaryRefinementService.ts");
if (/openRouterJson|OPENROUTER_API_KEY|openAITranscriptionClient|new OpenAI|chat\.completions/i.test(boundaryRefinement)) {
  fail("Boundary refinement must remain local and must not call OpenAI/OpenRouter.");
}

const candidateGeneration = read("lib/domain/services/ClipCandidateGenerationService.ts");
if (/openRouterJson|OPENROUTER_API_KEY|openAITranscriptionClient|new OpenAI|chat\.completions/i.test(candidateGeneration)) {
  fail("Candidate timestamp generation must remain local and must not call OpenAI/OpenRouter.");
}

const reranking = read("lib/domain/services/ClipRerankingService.ts");
if (!reranking.includes("rerankClipCandidates")) {
  fail("ClipRerankingService must route reranking through the OpenRouter reasoning provider.");
}

const virality = read("lib/services/virality.service.ts");
if (!virality.includes("scoreClipVirality")) {
  fail("Virality scoring must route through the OpenRouter reasoning provider.");
}
if (/openAI|OpenAI|chat\.completions/i.test(virality)) {
  fail("Virality scoring must not use direct OpenAI reasoning.");
}

for (const relativePath of activePipelineFiles) {
  const source = read(relativePath);
  if (
    !relativePath.includes("openai-transcription-provider") &&
    !relativePath.includes("openai-transcription-client") &&
    /new OpenAI|from ["']openai["']/.test(source)
  ) {
    fail(`Direct OpenAI client import found outside transcription provider: ${relativePath}`);
  }
}

if (failures.length > 0) {
  console.error("Repurpose provider boundary check failed:");
  for (const message of failures) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

console.log("Repurpose provider boundary check passed.");
