import { NextResponse } from "next/server";
import type { ZodSchema, TypeOf } from "zod";

const CACHE_HEADERS = { "Cache-Control": "no-store" } as const;

export function ok<T>(data: T, init: ResponseInit = {}) {
  return NextResponse.json(data, mergeInit(init, { headers: CACHE_HEADERS }));
}

export function fail(status: number, error: unknown) {
  const payload =
    error instanceof Error
      ? { error: error.message }
      : typeof error === "string"
        ? { error }
        : { error: "Unexpected error" };
  return NextResponse.json(payload, mergeInit({ status }, { headers: CACHE_HEADERS }));
}

export async function parseJson<T>(request: Request, schema: ZodSchema<T>) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return { success: false as const, response: fail(400, "Invalid JSON payload") };
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    return { success: false as const, response: fail(400, result.error.flatten()) };
  }

  return { success: true as const, data: result.data };
}

function mergeInit(first: ResponseInit, second: ResponseInit): ResponseInit {
  return {
    ...first,
    ...second,
    headers: {
      ...(first.headers ?? {}),
      ...(second.headers ?? {})
    }
  };
}
