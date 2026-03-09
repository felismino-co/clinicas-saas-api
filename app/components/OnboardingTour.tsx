"use client";

import { useEffect, useState } from "react";

export type TourStep = {
  title: string;
  description: string;
  elementId?: string;
};

type Props = {
  steps: TourStep[];
  onComplete: () => void;
  storageKey: string;
};

export default function OnboardingTour({ steps, onComplete, storageKey }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    const completed = localStorage.getItem(storageKey);
    if (completed === "true") {
      setVisible(false);
    }
  }, [storageKey]);

  const handleComplete = () => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(storageKey, "true");
    }
    setVisible(false);
    onComplete();
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handlePrev = () => {
    setStepIndex((i) => Math.max(0, i - 1));
  };

  const handleNext = () => {
    if (stepIndex >= steps.length - 1) {
      handleComplete();
      return;
    }
    setStepIndex((i) => i + 1);
  };

  if (!visible || steps.length === 0) return null;

  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-800">
            Passo {stepIndex + 1} de {steps.length}
          </span>
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Pular
          </button>
        </div>
        <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
        <p className="mt-2 text-slate-600 whitespace-pre-wrap">{step.description}</p>
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handlePrev}
            disabled={isFirst}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {isLast ? "Concluir" : "Próximo"}
          </button>
        </div>
      </div>
    </div>
  );
}
