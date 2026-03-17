import { getTopRecommendedSlots } from "../scheduler-recommendations";

describe("getTopRecommendedSlots", () => {
  it("returns the highest scoring upcoming slots first", () => {
    const from = new Date(2026, 1, 27, 10, 15, 0, 0);
    const slots = getTopRecommendedSlots(
      [
        {
          day: "Fri",
          hours: [
            { hour: 9, score: 62, samples: 2 },
            { hour: 14, score: 88, samples: 5 },
          ],
        },
        {
          day: "Sat",
          hours: [{ hour: 11, score: 75, samples: 3 }],
        },
      ],
      { from, limit: 2, minScore: 55 }
    );

    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({ day: "Fri", hour: 14, score: 88 });
    expect(slots[1]).toMatchObject({ day: "Sat", hour: 11, score: 75 });
    expect(slots[0].startsAt.getDay()).toBe(5);
    expect(slots[0].startsAt.getHours()).toBe(14);
  });

  it("rolls same-day past hours into next week", () => {
    const from = new Date(2026, 1, 27, 18, 0, 0, 0);
    const slots = getTopRecommendedSlots(
      [
        {
          day: "Fri",
          hours: [{ hour: 14, score: 90, samples: 4 }],
        },
      ],
      { from, limit: 1, minScore: 55 }
    );

    expect(slots).toHaveLength(1);
    expect(slots[0].startsAt.getDay()).toBe(5);
    expect(slots[0].startsAt.getHours()).toBe(14);
    expect(slots[0].startsAt.getDate()).toBe(6);
  });

  it("filters out low-signal slots", () => {
    const slots = getTopRecommendedSlots(
      [
        {
          day: "Mon",
          hours: [
            { hour: 8, score: 30, samples: 1 },
            { hour: 12, score: 54, samples: 5 },
          ],
        },
      ],
      { minScore: 55 }
    );

    expect(slots).toEqual([]);
  });
});
