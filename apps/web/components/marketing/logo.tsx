import { cn } from "@/lib/utils";

interface LogoProps extends React.SVGAttributes<SVGElement> {}

export function Logo({ className, ...props }: LogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-primary", className)}
      {...props}
    >
      <rect x="2" y="5" width="28" height="22" rx="5" className="fill-primary/10" />
      <path
        d="M10 22.5V9.5C10 9.22386 10.2239 9 10.5 9H13.5C13.7761 9 14 9.22386 14 9.5V22.5C14 22.7761 13.7761 23 13.5 23H10.5C10.2239 23 10 22.7761 10 22.5Z"
        className="fill-primary"
      />
      <path
        d="M18 9.5C18 9.22386 18.2239 9 18.5 9H21.5C21.7761 9 22 9.22386 22 9.5V22.5C22 22.7761 21.7761 23 21.5 23H18.5C18.2239 23 18 22.7761 18 22.5V9.5Z"
        className="fill-primary"
      />
    </svg>
  );
}
