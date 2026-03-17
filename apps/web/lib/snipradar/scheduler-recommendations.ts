export interface SchedulerHeatmapHour {
  hour: number;
  score: number;
  samples: number;
}

export interface SchedulerHeatmapDay {
  day: string;
  hours: SchedulerHeatmapHour[];
}

export interface RecommendedSchedulerSlot {
  day: string;
  hour: number;
  score: number;
  samples: number;
  startsAt: Date;
}

const DAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function nextDateForDayHour(from: Date, day: string, hour: number) {
  const target = new Date(from);
  const currentDay = from.getDay();
  const nextDay = DAY_INDEX[day];
  if (nextDay === undefined) {
    return null;
  }

  let offset = nextDay - currentDay;
  if (offset < 0 || (offset === 0 && hour <= from.getHours())) {
    offset += 7;
  }

  target.setDate(target.getDate() + offset);
  target.setHours(hour, 0, 0, 0);
  return target;
}

export function getTopRecommendedSlots(
  heatmap: SchedulerHeatmapDay[],
  options?: { from?: Date; limit?: number; minScore?: number }
): RecommendedSchedulerSlot[] {
  const from = options?.from ?? new Date();
  const limit = options?.limit ?? 3;
  const minScore = options?.minScore ?? 55;

  const candidates = heatmap.flatMap((day) =>
    day.hours
      .filter((hour) => hour.score >= minScore)
      .map((hour) => {
        const startsAt = nextDateForDayHour(from, day.day, hour.hour);
        if (!startsAt) {
          return null;
        }
        return {
          day: day.day,
          hour: hour.hour,
          score: hour.score,
          samples: hour.samples,
          startsAt,
        } satisfies RecommendedSchedulerSlot;
      })
      .filter((slot): slot is RecommendedSchedulerSlot => Boolean(slot))
  );

  return candidates
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.samples !== a.samples) {
        return b.samples - a.samples;
      }
      return a.startsAt.getTime() - b.startsAt.getTime();
    })
    .slice(0, limit);
}
