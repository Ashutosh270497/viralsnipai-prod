import { ImagenWorkspace } from "@/components/imagen/imagen-workspace";
import { getCurrentUser } from "@/lib/auth";

export default async function ImagenPage() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Imagen</h1>
        <p className="text-muted-foreground">
          Rapidly concept product shots, marketing visuals, and thumbnails without leaving ViralSnipAI.
        </p>
      </div>
      <ImagenWorkspace userName={user.name ?? "you"} />
    </div>
  );
}
