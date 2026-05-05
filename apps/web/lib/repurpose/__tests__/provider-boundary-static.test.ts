import { readFileSync } from "fs";
import path from "path";

const ROOT = process.cwd();

function read(relativePath: string) {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("V1 provider boundary static guard", () => {
  it("keeps final V1 auto-highlight boundaries out of LLM percentage logic", () => {
    const source = read("lib/application/use-cases/GenerateAutoHighlightsUseCase.ts");

    expect(source).not.toContain("startPercent");
    expect(source).not.toContain("endPercent");
    expect(source).toContain("candidateGenerationService.generateCandidates");
    expect(source).toContain("clipRerankingService.rerank");
    expect(source).toContain("boundaryRefinementService.refine");
  });

  it("does not route transcription through OpenRouter", () => {
    const source = read("lib/transcript.ts");
    expect(source).toContain("transcribeWithOpenAI");
    expect(source).not.toContain("OPENROUTER_TRANSCRIBE_MODEL");
    expect(source).not.toContain("transcribeWithOpenRouter");
  });

  it("registers the executable provider boundary check", () => {
    const pkg = JSON.parse(read("package.json"));
    const script = read("scripts/repurpose-provider-boundary-check.ts");

    expect(pkg.scripts["repurpose:boundary-check"]).toBe(
      "tsx scripts/repurpose-provider-boundary-check.ts",
    );
    expect(script).toContain("Repurpose provider boundary check failed");
    expect(script).toContain("Boundary refinement must remain local");
  });
});
