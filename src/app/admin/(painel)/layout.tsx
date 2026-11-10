import { AdminShell } from "@/components/admin/AdminShell";
import { DraftProvider } from "@/components/admin/DraftProvider";
import { FeedbackProvider } from "@/components/admin/ui";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeedbackProvider>
      <DraftProvider>
        <AdminShell>{children}</AdminShell>
      </DraftProvider>
    </FeedbackProvider>
  );
}
