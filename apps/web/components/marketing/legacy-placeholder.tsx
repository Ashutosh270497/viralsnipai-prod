import Link from "next/link";

export function LegacyMarketingPlaceholder({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      <div className="text-xs text-muted-foreground">
        <span className="mr-2">Looking for details?</span>
        <Link href="/" className="underline">
          Head back to the homepage
        </Link>
      </div>
    </div>
  );
}
