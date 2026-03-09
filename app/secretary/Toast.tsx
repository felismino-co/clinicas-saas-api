"use client";

import { useEffect } from "react";

export type ToastType = "success" | "error" | "info";

type Props = {
  message: string;
  type: ToastType;
  onDismiss: () => void;
  duration?: number;
};

const typeStyles: Record<ToastType, string> = {
  success: "bg-emerald-600 text-white border-emerald-700",
  error: "bg-rose-600 text-white border-rose-700",
  info: "bg-sky-600 text-white border-sky-700",
};

export default function Toast({ message, type, onDismiss, duration = 3000 }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss]);

  return (
    <div
      role="alert"
      className={`fixed bottom-6 right-6 z-[100] rounded-lg border px-4 py-3 shadow-lg transition-opacity ${typeStyles[type]}`}
    >
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
