import { getConditionIconPath } from "@/lib/utils/conditionIcons";

interface ConditionIconProps {
  name: string;
  className?: string;
}

export function ConditionIcon({ name, className = "h-3.5 w-3.5" }: ConditionIconProps) {
  const src = getConditionIconPath(name);
  if (!src) return null;
  return <img src={src} alt="" aria-hidden="true" className={`${className} shrink-0`} />;
}
