import { Metadata } from "next";

import { TemplateMarketplacePage } from "@/components/templates/marketplace";

export const metadata: Metadata = {
  title: "Template Marketplace · Clippers",
  description: "Browse, submit, and monetize Clippers templates with revenue share."
};

export default function TemplateMarketplace() {
  return <TemplateMarketplacePage />;
}
