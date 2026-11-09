import { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "master";
  isLoading?: boolean;
  bgImage?: string;
}

export function Button({
  children,
  variant = "primary",
  isLoading = false,
  bgImage,
  className = "",
  disabled,
  style,
  ...props
}: ButtonProps) {
  const baseStyles =
    "px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center";

  const variantStyles = {
    // Primary: Accent com texto branco de alto contraste
    primary: "bg-accent text-white hover:bg-accent-vibrant active:bg-accent-dark shadow-sm",
    // Secondary: Secundário Card com borda secundária e texto puro
    secondary:
      "bg-secondary-card text-secondary-pure border border-secondary-border hover:bg-dominant-container hover:border-accent-vibrant",
    // Danger: Accent Dark com borda contrastante
    danger:
      "bg-accent-dark text-white border border-accent-vibrant/40 hover:bg-accent hover:border-accent-vibrant",
    // Master: Accent com Glow e texto branco de alto contraste
    master:
      "bg-accent text-white hover:bg-accent-vibrant shadow-[0_0_15px_var(--accent-glow)] border border-accent-vibrant/30",
  };

  const hasBgImage = bgImage !== undefined;

  const bgImageStyles =
    "bg-transparent bg-contain bg-center bg-no-repeat text-secondary-pure hover:opacity-90 active:opacity-100 px-8 py-4";

  const combinedStyle = hasBgImage
    ? {
        ...(bgImage ? { backgroundImage: `url("${bgImage}")` } : {}),
        ...style,
      }
    : style;

  const combinedClassName = hasBgImage
    ? `${baseStyles} ${bgImageStyles} ${className}`
    : `${baseStyles} ${variantStyles[variant]} ${className}`;

  return (
    <button
      className={combinedClassName}
      style={combinedStyle}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <Spinner size="sm" />
          Carregando...
        </span>
      ) : (
        children
      )}
    </button>
  );
}
