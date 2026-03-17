import {
  buildRelationshipPriorityScore,
  mergeRelationshipStage,
  normalizeRelationshipHandle,
  normalizeRelationshipTags,
  stageFromOpportunityStatus,
} from "@/lib/snipradar/relationships";

describe("relationship graph helpers", () => {
  it("normalizes handles and tags", () => {
    expect(normalizeRelationshipHandle("@Ashutosh_270497")).toBe("ashutosh_270497");
    expect(
      normalizeRelationshipTags([" Founder ", "founder", "Creator", "", "warm lead"])
    ).toEqual(["founder", "creator", "warm lead"]);
  });

  it("promotes stages without downgrading active leads", () => {
    expect(mergeRelationshipStage("engaged", "priority")).toBe("priority");
    expect(mergeRelationshipStage("priority", "engaged")).toBe("priority");
    expect(mergeRelationshipStage("closed", "engaged")).toBe("engaged");
  });

  it("derives lead stage from engagement opportunity status", () => {
    expect(stageFromOpportunityStatus("saved")).toBe("engaged");
    expect(stageFromOpportunityStatus("replied")).toBe("follow_up");
    expect(stageFromOpportunityStatus("ignored")).toBe("new");
  });

  it("scores follow-up and tracked leads above cold leads", () => {
    const cold = buildRelationshipPriorityScore({
      stage: "new",
      followerCount: 120,
      savedOpportunityCount: 0,
      replyCount: 0,
      inboxCaptureCount: 0,
      tracked: false,
      dueFollowUp: false,
    });

    const warm = buildRelationshipPriorityScore({
      stage: "follow_up",
      followerCount: 5400,
      savedOpportunityCount: 2,
      replyCount: 1,
      inboxCaptureCount: 1,
      tracked: true,
      dueFollowUp: true,
    });

    expect(warm).toBeGreaterThan(cold);
    expect(warm).toBeLessThanOrEqual(100);
  });
});
