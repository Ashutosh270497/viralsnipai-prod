import { BrandKitForm } from "@/components/brand-kit/brand-kit-form";
import { getCurrentUser } from "@/lib/auth";
import { getBrandKit } from "@/lib/brand-kit";
import { prisma } from "@/lib/prisma";
import { isPaidPlan } from "@/lib/watermark";

export default async function BrandKitPage() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const [brandKit, account] = await Promise.all([
    getBrandKit(user.id),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true }
    })
  ]);
  const canToggleWatermark = isPaidPlan(account?.plan);

  // Type-safe caption style parsing
  const captionStyleData = brandKit.captionStyle as Record<string, any> | null | undefined;
  const captionStyle = {
    karaoke: captionStyleData?.karaoke ?? true,
    outline: captionStyleData?.outline ?? true,
    position: (captionStyleData?.position as "bottom" | "middle" | "top") ?? "bottom"
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Brand kit</h1>
        <p className="text-muted-foreground">Keep every clip and export on-brand automatically.</p>
      </div>
      <BrandKitForm
        canToggleWatermark={canToggleWatermark}
        initial={{
          primaryHex: brandKit.primaryHex,
          fontFamily: brandKit.fontFamily,
          logoPath: brandKit.logoPath,
          logoStoragePath: brandKit.logoStoragePath,
          watermark: brandKit.watermark,
          captionStyle
        }}
      />
    </div>
  );
}
