import { ButtonLink, Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <main id="main" className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <Logo />
      <div>
        <p className="text-5xl font-semibold tracking-tight">404</p>
        <p className="mt-2 text-muted">This page doesn’t exist (or the booking link is wrong).</p>
      </div>
      <ButtonLink href="/">Go home</ButtonLink>
    </main>
  );
}
