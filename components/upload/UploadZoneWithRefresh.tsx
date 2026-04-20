"use client";

import { useRouter } from "next/navigation";
import { UploadZone } from "./UploadZone";
import type { UploadResponse } from "@/lib/schema";

export function UploadZoneWithRefresh() {
  const router = useRouter();

  const handleComplete = (_result: UploadResponse & { filename: string }) => {
    router.refresh();
  };

  return <UploadZone onComplete={handleComplete} />;
}
