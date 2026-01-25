import { prisma } from "@/lib/prisma";

export async function getBrandKit(userId: string) {
  const kit = await prisma.brandKit.findUnique({ where: { userId } });
  if (kit) {
    return kit;
  }

  return prisma.brandKit.create({
    data: {
      userId,
      primaryHex: "#00A3FF",
      fontFamily: "Inter",
      captionStyle: {
        karaoke: true,
        outline: true,
        position: "bottom"
      }
    }
  });
}
