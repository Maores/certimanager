"use client";

import { useRouter } from "next/navigation";
import { DeleteButton } from "@/components/ui/delete-button";
import { deleteFeedback } from "./actions";

export function DeleteFeedbackButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <DeleteButton
      action={async () => {
        await deleteFeedback(id);
        router.refresh();
      }}
    />
  );
}
