import { Suspense } from "react";
import { SlideEditor } from "./SlideEditor";

export default async function SlideEditorPage({ params }: PageProps<"/admin/pecas/[id]">) {
  const { id } = await params;
  return (
    <Suspense fallback={<p className="text-sm text-sand-500">Carregando…</p>}>
      <SlideEditor id={id} />
    </Suspense>
  );
}
