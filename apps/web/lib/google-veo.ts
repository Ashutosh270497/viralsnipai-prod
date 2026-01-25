import { createVeoService } from "./veo/service";
import { createMockVideo, type VeoRequest, type VeoVideo } from "./veo/types";

let cachedService: ReturnType<typeof createVeoService> | null = null;

function getService(): ReturnType<typeof createVeoService> | null {
  if (cachedService) {
    return cachedService;
  }
  try {
    cachedService = createVeoService();
    return cachedService;
  } catch (error) {
    console.error("[Veo] Unable to initialise service. Falling back to mock generator.", error);
    return null;
  }
}

export type { VeoRequest, VeoVideo } from "./veo/types";

export async function generateVeoVideo(request: VeoRequest): Promise<VeoVideo> {
  const service = getService();
  if (!service) {
    return createMockVideo(request);
  }

  try {
    return await service.generate(request);
  } catch (error) {
    console.error("Veo request failed", error);
    return createMockVideo(request);
  }
}
