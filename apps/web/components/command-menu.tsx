"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useFeatureFlags } from "@/components/providers/feature-flag-provider";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type CommandAction = {
  id: string;
  label: string;
  hint?: string;
  route: string;
};

const ACTIONS: CommandAction[] = [
  {
    id: "go-projects",
    label: "Go to Projects",
    hint: "Open your workspace projects",
    route: "/projects"
  },
  {
    id: "new-project",
    label: "Create New Project",
    hint: "Jump to the projects dashboard to start fresh",
    route: "/projects#new"
  },
  {
    id: "open-templates",
    label: "Open Templates",
    hint: "Browse repurpose templates",
    route: "/repurpose"
  }
];

export function CommandMenu() {
  const router = useRouter();
  const { uiV2Enabled } = useFeatureFlags();
  const [open, setOpen] = useState(false);

  const modifierKey = useMemo(() => (typeof navigator !== "undefined" ? (/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform) ? "⌘" : "Ctrl") : "⌘"), []);

  useEffect(() => {
    if (!uiV2Enabled) {
      return;
    }

    const handler = (event: KeyboardEvent) => {
      const isModifierPressed = event.metaKey || event.ctrlKey;
      if (event.key.toLowerCase() === "k" && isModifierPressed) {
        event.preventDefault();
        setOpen((state) => !state);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [uiV2Enabled]);

  const handleSelect = (action: CommandAction) => {
    setOpen(false);
    requestAnimationFrame(() => {
      router.push(action.route);
    });
  };

  if (!uiV2Enabled) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0" data-testid="command-menu">
        <Command label="Quick actions">
          <CommandInput placeholder="Search actions..." />
          <CommandList>
            <CommandEmpty>No actions found.</CommandEmpty>
            <CommandGroup heading="Navigation">
              {ACTIONS.map((action) => (
                <CommandItem
                  key={action.id}
                  value={action.label}
                  onSelect={() => handleSelect(action)}
                  data-testid={`command-action-${action.id}`}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{action.label}</span>
                    {action.hint ? <span className="text-xs text-muted-foreground">{action.hint}</span> : null}
                  </div>
                  <CommandShortcut>{modifierKey}K</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Shortcuts">
              <CommandItem value="keyboard-shortcuts" data-testid="command-action-keyboard">
                Keyboard shortcuts
                <CommandShortcut>?</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
