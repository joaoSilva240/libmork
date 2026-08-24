import React from "react";
import Image from "next/image";

type DecorativeFrameProps = {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
};

/**
 * Componente de moldura decorativa usando Frame 17.
 * A imagem é esticada para cobrir todo o container como decoração de borda.
 */
export function DecorativeFrame({ children, className = "", innerClassName = "" }: DecorativeFrameProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Imagem decorativa esticada cobrindo todo o elemento e se estendendo além das bordas */}
      <div className="absolute pointer-events-none" style={{ inset: "-12px" }}>
        <Image
          src="/Frame 17.png"
          alt=""
          fill
          className="object-fill opacity-70"
          style={{ 
            mixBlendMode: "screen",
          }}
        />
      </div>

      <div className={`relative z-10 ${innerClassName}`}>
        {children}
      </div>
    </div>
  );
}
