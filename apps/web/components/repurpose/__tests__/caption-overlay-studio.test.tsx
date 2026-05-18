import { fireEvent, render, screen } from "@testing-library/react";

import { CaptionOverlayStudio } from "@/components/repurpose/caption-overlay-studio";

describe("CaptionOverlayStudio", () => {
  it("shows preset-first style choices without duplicate fast templates", () => {
    const { container } = render(
      <CaptionOverlayStudio value={null} onChange={jest.fn()} presetFirst totalClipCount={3} />
    );

    expect(screen.getByRole("option", { name: /Minimal Clean/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("Recommended")).toBeTruthy();
    expect(screen.getByText("Apply style to")).toBeTruthy();
    expect(screen.queryByText(/Fast templates/i)).toBeNull();

    const advancedDetails = Array.from(container.querySelectorAll("details")).find((details) =>
      details.textContent?.includes("Advanced style tools")
    );
    expect(advancedDetails).toBeTruthy();
    expect(advancedDetails?.hasAttribute("open")).toBe(false);
  });

  it("keeps selected clip scope disabled until clips are selected", () => {
    render(
      <CaptionOverlayStudio
        value={null}
        onChange={jest.fn()}
        presetFirst
        selectedClipCount={0}
        totalClipCount={2}
        onApplyToSelected={jest.fn()}
        onApplyToAll={jest.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /Selected clips/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /All generated \(2\)/i })).not.toBeDisabled();
  });

  it("confirms before applying style to all generated clips", () => {
    const onApplyToAll = jest.fn();
    jest.spyOn(window, "confirm").mockReturnValueOnce(true);

    render(
      <CaptionOverlayStudio
        value={null}
        onChange={jest.fn()}
        presetFirst
        totalClipCount={2}
        onApplyToAll={onApplyToAll}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /All generated \(2\)/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Apply style$/i }));

    expect(window.confirm).toHaveBeenCalledWith(
      "This will update caption styling for all generated clips in this project."
    );
    expect(onApplyToAll).toHaveBeenCalledTimes(1);
  });
});
