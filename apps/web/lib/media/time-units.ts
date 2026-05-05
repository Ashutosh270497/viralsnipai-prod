export type Milliseconds = number & { readonly __unit: 'ms' };
export type Seconds = number & { readonly __unit: 'sec' };

export function ms(value: number): Milliseconds {
  return Math.round(value) as Milliseconds;
}

export function sec(value: number): Seconds {
  return value as Seconds;
}

export function secondsToMs(value: Seconds): Milliseconds {
  return ms(value * 1000);
}

export function msToSeconds(value: Milliseconds): Seconds {
  return sec(value / 1000);
}
