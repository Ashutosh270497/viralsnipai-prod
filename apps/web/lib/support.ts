export function getSupportEmail() {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@viralsnipai.com";
}

export function getSupportMailto(subject?: string) {
  const email = getSupportEmail();
  if (!subject) return `mailto:${email}`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}
