"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteUpload } from "./actions";

export function DeleteUploadButton({ uploadId }: { uploadId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = () => {
    if (!confirm("Delete this upload and all its encounters? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await deleteUpload(uploadId);
      if (result.ok) {
        router.refresh();
      } else {
        alert(`Delete failed: ${result.error}`);
      }
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-xs text-danger/60 hover:text-danger transition-colors disabled:opacity-40"
      title="Delete this upload and re-upload to re-parse"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
