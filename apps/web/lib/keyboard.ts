export type KeyAction = {
  key: string;
  description: string;
  handler: (event: KeyboardEvent) => void;
};

const isInputFocused = () => {
  if (typeof document === "undefined") return false;
  const active = document.activeElement;
  if (!active) return false;
  return ["INPUT", "TEXTAREA"].includes(active.tagName) || (active as HTMLElement).isContentEditable;
};

export function bindKeyboardShortcuts(actions: KeyAction[]) {
  if (typeof window === "undefined") return () => void 0;

  function handler(event: KeyboardEvent) {
    if (isInputFocused()) return;
    const match = actions.find((action) => action.key.toLowerCase() === event.key.toLowerCase());
    if (!match) return;
    match.handler(event);
  }

  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}
