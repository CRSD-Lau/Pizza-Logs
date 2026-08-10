"use client";

import { useRouter } from "next/navigation";
import { UploadZone } from "./UploadZone";
import type { UploadResponse } from "@/lib/schema";

export function UploadZoneWithRefresh() {
  const router = useRouter();

  const handleComplete = (_result: UploadResponse & { filename: string }) => {
    void _result;
    router.refresh();
  };

  return <UploadZone onComplete={handleComplete} />;
}
