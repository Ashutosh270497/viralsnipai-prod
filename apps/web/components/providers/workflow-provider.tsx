"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { usePathname } from "next/navigation";

export type WorkflowPhase =
  | "niche-discovery"
  | "content-calendar"
  | "script-generator"
  | "title-generator"
  | "thumbnail-generator"
  | "complete";

interface WorkflowContextData {
  currentPhase: WorkflowPhase | null;
  completedPhases: Set<WorkflowPhase>;
  currentContentId?: string;
  setCurrentContentId: (id: string | undefined) => void;
  markPhaseComplete: (phase: WorkflowPhase) => void;
  resetWorkflow: () => void;
  getNextPhase: () => WorkflowPhase | null;
  isPhaseAccessible: (phase: WorkflowPhase) => boolean;
}

const WorkflowContext = createContext<WorkflowContextData | undefined>(undefined);

const WORKFLOW_PHASES: WorkflowPhase[] = [
  "niche-discovery",
  "content-calendar",
  "script-generator",
  "title-generator",
  "thumbnail-generator",
  "complete",
];

const PHASE_DEPENDENCIES: Record<WorkflowPhase, WorkflowPhase[]> = {
  "niche-discovery": [],
  "content-calendar": [],
  "script-generator": ["content-calendar"],
  "title-generator": ["content-calendar"],
  "thumbnail-generator": ["content-calendar"],
  "complete": ["content-calendar", "script-generator", "title-generator", "thumbnail-generator"],
};

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [completedPhases, setCompletedPhases] = useState<Set<WorkflowPhase>>(new Set());
  const [currentContentId, setCurrentContentId] = useState<string | undefined>();
  const [currentPhase, setCurrentPhase] = useState<WorkflowPhase | null>(null);

  // Load saved workflow state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem("workflow-state");
    if (savedState) {
      try {
        const { completedPhases: saved } = JSON.parse(savedState);
        setCompletedPhases(new Set(saved));
      } catch (error) {
        console.error("Failed to load workflow state:", error);
      }
    }
  }, []);

  // Save workflow state to localStorage whenever it changes
  useEffect(() => {
    const state = {
      completedPhases: Array.from(completedPhases),
    };
    localStorage.setItem("workflow-state", JSON.stringify(state));
  }, [completedPhases]);

  // Detect current phase from pathname
  useEffect(() => {
    if (pathname?.includes("/niche-discovery")) {
      setCurrentPhase("niche-discovery");
    } else if (pathname?.includes("/content-calendar")) {
      setCurrentPhase("content-calendar");
    } else if (pathname?.includes("/script-generator")) {
      setCurrentPhase("script-generator");
    } else if (pathname?.includes("/title-generator")) {
      setCurrentPhase("title-generator");
    } else if (pathname?.includes("/thumbnail-generator")) {
      setCurrentPhase("thumbnail-generator");
    } else {
      setCurrentPhase(null);
    }
  }, [pathname]);

  const markPhaseComplete = (phase: WorkflowPhase) => {
    setCompletedPhases((prev) => new Set([...prev, phase]));
  };

  const resetWorkflow = () => {
    setCompletedPhases(new Set());
    setCurrentContentId(undefined);
    localStorage.removeItem("workflow-state");
  };

  const getNextPhase = (): WorkflowPhase | null => {
    if (!currentPhase) return WORKFLOW_PHASES[0];

    const currentIndex = WORKFLOW_PHASES.indexOf(currentPhase);
    if (currentIndex === -1 || currentIndex === WORKFLOW_PHASES.length - 1) {
      return null;
    }

    return WORKFLOW_PHASES[currentIndex + 1];
  };

  const isPhaseAccessible = (phase: WorkflowPhase): boolean => {
    const dependencies = PHASE_DEPENDENCIES[phase];
    return dependencies.every((dep) => completedPhases.has(dep));
  };

  return (
    <WorkflowContext.Provider
      value={{
        currentPhase,
        completedPhases,
        currentContentId,
        setCurrentContentId,
        markPhaseComplete,
        resetWorkflow,
        getNextPhase,
        isPhaseAccessible,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useWorkflow must be used within a WorkflowProvider");
  }
  return context;
}
