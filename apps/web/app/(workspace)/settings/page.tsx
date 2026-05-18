import { getCurrentUser } from "@/lib/auth";
import { getSupportEmail, getSupportMailto } from "@/lib/support";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account profile and workspace preferences.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Account</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Name
            </p>
            <p className="mt-1 text-sm">{user?.name ?? "Not set"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Email
            </p>
            <p className="mt-1 break-words text-sm">{user?.email ?? "Not set"}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Help &amp; support</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Need help with uploads, clipping, exports, or billing? Contact support and include
          your project name when possible.
        </p>
        <a
          href={getSupportMailto("ViralSnipAI support")}
          className="mt-4 inline-flex break-all text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          {getSupportEmail()}
        </a>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Launch Version</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This workspace is configured for the V1 core video repurposing launch by default.
          V2 creator growth and V3 automation modules stay hidden until their feature flags are
          enabled.
        </p>
      </section>
    </div>
  );
}
