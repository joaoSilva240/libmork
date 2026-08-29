"use client";

import { useEffect } from "react";
import { installFetchCsrfPatch } from "@/lib/client/fetch-csrf-patch";

export default function CsrfInit() {
  useEffect(() => {
    installFetchCsrfPatch();
  }, []);
  return null;
}
