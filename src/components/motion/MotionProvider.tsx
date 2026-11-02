"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useResolvedMotion } from "@/hooks/useMotionPreferences";
import {
  applyMotion,
  enterTransform,
  isMotionCategoryActive,
  motionDuration,
} from "@/lib/motion";

/**
 * Aplica as preferências de animação no <html> (variáveis CSS + atributos) e
 * anima a troca de rotas. Não renderiza nada e fica ocioso entre navegações.
 */
export default function MotionProvider() {
  const resolved = useResolvedMotion();
  const resolvedRef = useRef(resolved);
  const pathname = usePathname();
  const previousPathRef = useRef(pathname);

  useEffect(() => {
    resolvedRef.current = resolved;
    applyMotion(document.documentElement, resolved);
  }, [resolved]);

  useEffect(() => {
    if (previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;
    const motion = resolvedRef.current;
    if (!isMotionCategoryActive(motion, "pages")) return;
    const target =
      document.querySelector<HTMLElement>("[data-motion-route]") ?? document.querySelector("main");
    if (!target || typeof target.animate !== "function") return;
    // transform/filter criam um novo bloco de contenção e deslocariam elementos `fixed`
    // da página durante a animação; nesse caso usamos apenas o esmaecimento.
    const fadeOnly = target.querySelector(".fixed") !== null;
    const from: Keyframe = fadeOnly
      ? { opacity: 0 }
      : {
          opacity: 0,
          transform: enterTransform(motion.enter),
          filter: `blur(${motion.enter.blur}px)`,
        };
    const to: Keyframe = fadeOnly
      ? { opacity: 1 }
      : { opacity: 1, transform: "none", filter: "blur(0px)" };
    target.animate([from, to], { duration: motionDuration(motion, "base"), easing: motion.easing });
  }, [pathname]);

  return null;
}
