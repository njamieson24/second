import Link from "next/link";

export function TextLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`font-medium text-sky-ink underline hover:text-ink ${className}`}>
      {children}
    </Link>
  );
}
