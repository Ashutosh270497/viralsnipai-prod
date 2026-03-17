import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SubmitTemplatePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-12">
      <div className="space-y-4 text-center">
        <Badge className="bg-[#F3F6FF] text-[#4C8EFF]">Submit template</Badge>
        <h1 className="text-4xl font-semibold text-foreground">Share your ViralSnipAI template</h1>
        <p className="text-sm text-muted-foreground">
          Add a new template to the marketplace. Provide safe zones, captions, overlays, and preview media so editors can install with one click.
        </p>
      </div>
      <Card className="border border-border/70 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle>Submission checklist</CardTitle>
          <CardDescription>Make sure your template meets marketplace guidelines before you submit.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>• Include .clipper-template JSON and any referenced assets (fonts, overlays, LUTs).</li>
            <li>• Provide a 9:16 preview clip showcasing transitions, captions, and safe zones.</li>
            <li>• Ensure audio levels mix within -14 LUFS and visuals comply with platform policies.</li>
            <li>• Add caption styles, automation instructions, and recommended callouts.</li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/templates/upload">Start submission</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/templates/revenue">Learn about revenue share</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
