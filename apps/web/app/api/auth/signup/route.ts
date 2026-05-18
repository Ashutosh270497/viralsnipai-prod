import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { recordActivationCheckpointSafe } from "@/lib/analytics/activation";
import { ensureSubscriptionBootstrap } from "@/lib/billing/subscriptions";
import { signupSchema } from "@/lib/validations";
import { assertSameOriginRequest } from "@/lib/security/origin";
import { consumeV1RateLimit, rateLimitResponse, V1_RATE_LIMITS } from "@/lib/security/rate-limit";
import { sanitizeForLog } from "@/lib/logger/redact";

export async function POST(request: NextRequest) {
  const originError = assertSameOriginRequest(request);
  if (originError) return originError;

  const rateLimit = await consumeV1RateLimit({
    request,
    routeKey: "signup",
    rules: V1_RATE_LIMITS.SIGNUP,
  });
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit, "Too many signup attempts. Please try again later.");
  }

  try {
    const body = await request.json();

    // Validate input
    const validatedData = signupSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name || null,
        onboardingCompleted: false
      }
    });

    await recordActivationCheckpointSafe({
      userId: user.id,
      checkpoint: "creator_onboarding_started",
      metadata: {
        source: "signup_credentials",
      },
    });

    await ensureSubscriptionBootstrap(user.id);

    // Return success (without password)
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    }, { status: 201 });

  } catch (error: any) {
    // Handle Zod validation errors
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }

    // Handle other errors
    console.error("Signup error:", sanitizeForLog(error));
    return NextResponse.json(
      { error: "An error occurred during signup" },
      { status: 500 }
    );
  }
}
