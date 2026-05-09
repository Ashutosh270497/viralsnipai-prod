export type ParsedRange =
  | { ok: true; start: number; end: number; contentLength: number }
  | { ok: false; status: 416 };

export function parseHttpRangeHeader(rangeHeader: string | null, fileSize: number): ParsedRange | null {
  if (!rangeHeader) return null;
  if (!Number.isFinite(fileSize) || fileSize <= 0) return { ok: false, status: 416 };

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return { ok: false, status: 416 };

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return { ok: false, status: 416 };

  let start: number;
  let end: number;

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return { ok: false, status: 416 };
    }
    start = Math.max(0, fileSize - suffixLength);
    end = fileSize - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : fileSize - 1;
  }

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= fileSize
  ) {
    return { ok: false, status: 416 };
  }

  end = Math.min(end, fileSize - 1);
  return { ok: true, start, end, contentLength: end - start + 1 };
}

export function isInsideDirectory(rootDir: string, candidatePath: string, pathSeparator: string) {
  return candidatePath === rootDir || candidatePath.startsWith(`${rootDir}${pathSeparator}`);
}
