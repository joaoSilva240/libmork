import { Suspense } from "react";
import { PlayerDashboard } from "@/components/player/PlayerDashboard";

export default function PlayerPage() {
  return (
    <Suspense>
      <PlayerDashboard />
    </Suspense>
  );
}
