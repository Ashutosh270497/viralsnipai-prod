import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TemplateRevenuePage() {
  return (
    <div className="mx-auto flex w/full max-w-4xl flex-col gap-10 px-6 py-12">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-semibold text-foreground">Revenue share program</h1>
        <p className="text-sm text-muted-foreground">
          Marketplace creators keep 70% of each sale. Payouts run monthly via Razorpay, with support for team splits and promotional codes.
        </p>
      </div>
      <Card className="border border-border/70 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle>Payout structure</CardTitle>
          <CardDescription>Three simple rules keep template revenue transparent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>• 70% creator share, 30% ViralSnipAI platform fee.</p>
          <p>• Payouts triggered monthly once earnings pass $50 (USD or local equivalent).</p>
          <p>• Team templates can split revenue between up to five collaborators.</p>
          <Button asChild className="mt-6">
            <Link href="/templates/submit">Submit your template</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
