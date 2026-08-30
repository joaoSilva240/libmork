import { Suspense } from "react";
import { CharacterWizard } from "@/components/characters/CharacterWizard";
import { Spinner } from "@/components/ui";

export default function NewCharacterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[300px] items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <CharacterWizard />
    </Suspense>
  );
}
