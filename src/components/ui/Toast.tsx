"use client";

import { useEffect, useState } from "react";

type ToastType = "error" | "success" | "info" | "warning";

type ToastProps = {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
};

export function Toast({ message, type = "error", duration = 2000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation
    setIsVisible(true);

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade-out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const typeStyles = {
    error: "border-red-800 bg-red-900/90 text-red-300",
    success: "border-green-800 bg-green-900/90 text-green-300",
    info: "border-blue-800 bg-blue-900/90 text-blue-300",
    warning: "border-amber-800 bg-amber-900/90 text-amber-300",
  };

  return (
    <div
      className={`fixed top-4 right-4 z-[9999] rounded-lg border px-4 py-3 text-sm font-medium shadow-lg transition-all duration-300 ${
        typeStyles[type]
      } ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}
    >
      {message}
    </div>
  );
}

type ToastContainerProps = {
  toasts: Array<{ id: string; message: string; type?: ToastType }>;
  onRemove: (id: string) => void;
};

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
}
