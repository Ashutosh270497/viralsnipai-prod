import { HttpError, getFriendlyHttpErrorMessage } from "@/lib/http/client";

describe("http client errors", () => {
  it("maps session expiry to user-friendly copy", () => {
    expect(getFriendlyHttpErrorMessage(new HttpError("Unauthorized", 401))).toBe(
      "Your session expired. Please sign in again.",
    );
  });

  it("maps upload limits to user-friendly copy", () => {
    expect(getFriendlyHttpErrorMessage(new HttpError("Too large", 413))).toBe(
      "That file is too large for the current upload limit.",
    );
  });

  it("keeps specific non-status errors", () => {
    expect(getFriendlyHttpErrorMessage(new HttpError("Timed out", 408))).toBe("Timed out");
  });
});

