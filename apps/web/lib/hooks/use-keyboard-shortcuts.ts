"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description?: string;
}

/**
 * Hook for registering keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      shortcuts.forEach((shortcut) => {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrl ? event.ctrlKey || event.metaKey : true;
        const shiftMatches = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatches = shortcut.alt ? event.altKey : !event.altKey;
        const metaMatches = shortcut.meta ? event.metaKey : true;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches) {
          event.preventDefault();
          shortcut.action();
        }
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, enabled]);
}

/**
 * Hook for global navigation shortcuts
 */
export function useNavigationShortcuts() {
  const router = useRouter();

  const shortcuts: KeyboardShortcut[] = [
    {
      key: "d",
      ctrl: true,
      action: () => router.push("/dashboard"),
      description: "Go to Dashboard",
    },
    {
      key: "n",
      ctrl: true,
      action: () => router.push("/niche-discovery"),
      description: "Niche Discovery",
    },
    {
      key: "c",
      ctrl: true,
      action: () => router.push("/dashboard/content-calendar"),
      description: "Content Calendar",
    },
    {
      key: "s",
      ctrl: true,
      action: () => router.push("/dashboard/script-generator"),
      description: "Script Generator",
    },
    {
      key: "t",
      ctrl: true,
      action: () => router.push("/dashboard/title-generator"),
      description: "Title Generator",
    },
    {
      key: "i",
      ctrl: true,
      action: () => router.push("/dashboard/thumbnail-generator"),
      description: "Thumbnail Generator",
    },
  ];

  useKeyboardShortcuts(shortcuts);

  return shortcuts;
}

/**
 * Hook for showing keyboard shortcuts dialog
 */
export function useShortcutsDialog() {
  const [isOpen, setIsOpen] = useState(false);

  useKeyboardShortcuts(
    [
      {
        key: "?",
        shift: true,
        action: () => setIsOpen(true),
        description: "Show keyboard shortcuts",
      },
      {
        key: "Escape",
        action: () => setIsOpen(false),
      },
    ],
    true
  );

  return { isOpen, setIsOpen };
}

// Import useState at the top of the file
import { useState } from "react";
