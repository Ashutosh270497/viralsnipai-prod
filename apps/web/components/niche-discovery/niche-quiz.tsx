"use client";

import { useState } from "react";
import { ChevronRight, ChevronLeft, Sparkles, Clock, Target, Video, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { INTEREST_OPTIONS } from "@/lib/types/niche";
import type { NicheQuizInputs, SkillLevel, ContentGoal, ShowFacePreference } from "@/lib/types/niche";

interface NicheQuizProps {
  onComplete: (inputs: NicheQuizInputs) => void;
  isLoading?: boolean;
}

const STEPS = [
  {
    id: "interests",
    title: "What topics are you passionate about?",
    subtitle: "Select 2-5 topics that genuinely interest you",
    icon: Sparkles,
  },
  {
    id: "time",
    title: "How much time can you dedicate weekly?",
    subtitle: "Be realistic about your availability",
    icon: Clock,
  },
  {
    id: "skill",
    title: "What's your content creation skill level?",
    subtitle: "This helps us find niches that match your experience",
    icon: Target,
  },
  {
    id: "goal",
    title: "What's your primary content goal?",
    subtitle: "Choose the main type of value you want to provide",
    icon: Video,
  },
  {
    id: "face",
    title: "Do you want to show your face?",
    subtitle: "Some niches work better faceless, others need personality",
    icon: User,
  },
];

const SKILL_LEVELS: { value: SkillLevel; label: string; description: string }[] = [
  {
    value: "beginner",
    label: "Beginner",
    description: "New to content creation, learning the basics",
  },
  {
    value: "intermediate",
    label: "Intermediate",
    description: "Have some experience, comfortable with basics",
  },
  {
    value: "advanced",
    label: "Advanced",
    description: "Experienced creator, strong production skills",
  },
];

const CONTENT_GOALS: { value: ContentGoal; label: string; description: string }[] = [
  {
    value: "education",
    label: "Education",
    description: "Teach and share knowledge",
  },
  {
    value: "entertainment",
    label: "Entertainment",
    description: "Entertain and engage audiences",
  },
  {
    value: "reviews",
    label: "Reviews",
    description: "Review products, services, or media",
  },
  {
    value: "tutorials",
    label: "Tutorials",
    description: "Step-by-step how-to guides",
  },
  {
    value: "vlogs",
    label: "Vlogs",
    description: "Personal stories and lifestyle content",
  },
  {
    value: "news",
    label: "News & Commentary",
    description: "Current events and opinions",
  },
];

const FACE_OPTIONS: { value: ShowFacePreference; label: string; description: string }[] = [
  {
    value: "yes",
    label: "Yes, I want to be on camera",
    description: "Personal brand, face-to-camera content",
  },
  {
    value: "no",
    label: "No, I prefer faceless",
    description: "Voice-over, screen recordings, animations",
  },
  {
    value: "maybe",
    label: "Maybe sometimes",
    description: "Flexible approach, occasional appearances",
  },
];

export function NicheQuiz({ onComplete, isLoading = false }: NicheQuizProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<NicheQuizInputs>({
    interests: [],
    availableHoursPerWeek: 10,
    skillLevel: "beginner",
    primaryGoal: "education",
    showFace: "maybe",
  });

  const handleInterestToggle = (interest: string) => {
    setFormData((prev) => {
      const isSelected = prev.interests.includes(interest);
      if (isSelected) {
        return {
          ...prev,
          interests: prev.interests.filter((i) => i !== interest),
        };
      } else if (prev.interests.length < 5) {
        return {
          ...prev,
          interests: [...prev.interests, interest],
        };
      }
      return prev;
    });
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onComplete(formData);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Interests
        return formData.interests.length >= 2;
      case 1: // Time
        return formData.availableHoursPerWeek >= 2;
      case 2: // Skill
        return !!formData.skillLevel;
      case 3: // Goal
        return !!formData.primaryGoal;
      case 4: // Face
        return !!formData.showFace;
      default:
        return true;
    }
  };

  const step = STEPS[currentStep];
  const StepIcon = step.icon;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-neutral-400">
          <span>Step {currentStep + 1} of {STEPS.length}</span>
          <span>{Math.round(((currentStep + 1) / STEPS.length) * 100)}% complete</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-neutral-700">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
          <StepIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {step.title}
        </h2>
        <p className="mt-2 text-gray-600 dark:text-neutral-400">{step.subtitle}</p>
      </div>

      {/* Step Content */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        {currentStep === 0 && (
          <div className="space-y-4">
            <div className="text-sm text-gray-500 dark:text-neutral-400">
              Selected: {formData.interests.length}/5
            </div>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((interest) => {
                const isSelected = formData.interests.includes(interest);
                return (
                  <button
                    key={interest}
                    onClick={() => handleInterestToggle(interest)}
                    disabled={!isSelected && formData.interests.length >= 5}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                      isSelected
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-400"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:border-neutral-600",
                      !isSelected && formData.interests.length >= 5 && "cursor-not-allowed opacity-50"
                    )}
                  >
                    {interest}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <span className="text-5xl font-bold text-blue-600 dark:text-blue-400">
                {formData.availableHoursPerWeek}
              </span>
              <span className="ml-2 text-xl text-gray-500 dark:text-neutral-400">
                hours/week
              </span>
            </div>
            <Slider
              value={[formData.availableHoursPerWeek]}
              onValueChange={([value]) =>
                setFormData((prev) => ({ ...prev, availableHoursPerWeek: value }))
              }
              min={2}
              max={40}
              step={1}
              className="py-4"
            />
            <div className="flex justify-between text-sm text-gray-500 dark:text-neutral-400">
              <span>2 hrs (part-time hobby)</span>
              <span>40 hrs (full-time)</span>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-3">
            {SKILL_LEVELS.map((skill) => (
              <button
                key={skill.value}
                onClick={() =>
                  setFormData((prev) => ({ ...prev, skillLevel: skill.value }))
                }
                className={cn(
                  "w-full rounded-lg border p-4 text-left transition-all",
                  formData.skillLevel === skill.value
                    ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
                    : "border-gray-200 bg-white hover:border-gray-300 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-neutral-600"
                )}
              >
                <div className="font-semibold text-gray-900 dark:text-white">
                  {skill.label}
                </div>
                <div className="text-sm text-gray-600 dark:text-neutral-400">
                  {skill.description}
                </div>
              </button>
            ))}
          </div>
        )}

        {currentStep === 3 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {CONTENT_GOALS.map((goal) => (
              <button
                key={goal.value}
                onClick={() =>
                  setFormData((prev) => ({ ...prev, primaryGoal: goal.value }))
                }
                className={cn(
                  "rounded-lg border p-4 text-left transition-all",
                  formData.primaryGoal === goal.value
                    ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
                    : "border-gray-200 bg-white hover:border-gray-300 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-neutral-600"
                )}
              >
                <div className="font-semibold text-gray-900 dark:text-white">
                  {goal.label}
                </div>
                <div className="text-sm text-gray-600 dark:text-neutral-400">
                  {goal.description}
                </div>
              </button>
            ))}
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-3">
            {FACE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() =>
                  setFormData((prev) => ({ ...prev, showFace: option.value }))
                }
                className={cn(
                  "w-full rounded-lg border p-4 text-left transition-all",
                  formData.showFace === option.value
                    ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
                    : "border-gray-200 bg-white hover:border-gray-300 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-neutral-600"
                )}
              >
                <div className="font-semibold text-gray-900 dark:text-white">
                  {option.label}
                </div>
                <div className="text-sm text-gray-600 dark:text-neutral-400">
                  {option.description}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>

        <Button
          onClick={handleNext}
          disabled={!canProceed() || isLoading}
          className="gap-2 bg-blue-600 hover:bg-blue-700"
        >
          {isLoading ? (
            <>
              <span className="animate-pulse">Analyzing...</span>
            </>
          ) : currentStep === STEPS.length - 1 ? (
            <>
              <Sparkles className="h-4 w-4" />
              Get AI Recommendations
            </>
          ) : (
            <>
              Next
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
