import { prisma } from "@/lib/prisma";

export async function listUserProjects(userId: string) {
  return prisma.project.findMany({
    where: { userId },
    include: {
      clips: {
        orderBy: { createdAt: "desc" }
      },
      exports: {
        orderBy: { createdAt: "desc" }
      },
      assets: {
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 20
  });
}

export async function getProjectWithRelations(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      userId
    },
    include: {
      assets: {
        orderBy: { createdAt: "desc" }
      },
      clips: {
        orderBy: { createdAt: "desc" },
        include: {
          asset: true
        }
      },
      exports: {
        orderBy: { createdAt: "desc" }
      },
      script: true,
      user: {
        select: {
          id: true,
          brandKit: true
        }
      }
    }
  });
}
