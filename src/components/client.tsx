"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { setLocaleAction } from "@/server/actions/auth";
import type { Locale } from "@/i18n/dictionaries";
import { Button, cn } from "./ui";

export function SubmitButton({
  children,
  pendingText,
  ...props
}: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

export function LocaleSwitcher({ locale, label, className }: { locale: Locale; label: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className={cn("inline-flex items-center gap-1 text-sm text-muted", className)}>
      <span className="sr-only">{label}</span>
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 fill-current">
        <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm5.9 7h-2.4a12 12 0 0 0-1.1-4.6A6 6 0 0 1 15.9 9ZM10 4c.7.9 1.4 2.6 1.5 5h-3c.1-2.4.8-4.1 1.5-5ZM7.6 4.4A12 12 0 0 0 6.5 9H4.1a6 6 0 0 1 3.5-4.6ZM4.1 11h2.4c.1 1.8.5 3.4 1.1 4.6A6 6 0 0 1 4.1 11Zm5.9 5c-.7-.9-1.4-2.6-1.5-5h3c-.1 2.4-.8 4.1-1.5 5Zm2.4-.4c.6-1.2 1-2.8 1.1-4.6h2.4a6 6 0 0 1-3.5 4.6Z" />
      </svg>
      <select
        value={locale}
        disabled={pending}
        onChange={(e) => start(async () => {
          await setLocaleAction(e.target.value);
          router.refresh();
        })}
        className="cursor-pointer rounded-md bg-transparent py-1 pr-1 text-sm text-foreground focus:outline-none"
      >
        <option value="en">English</option>
        <option value="pt">Português</option>
      </select>
    </label>
  );
}

export function CopyButton({ value, label, copiedLabel }: { value: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </Button>
  );
}

/** A button that asks for confirmation, then runs a server action. */
export function ConfirmActionButton({
  action,
  confirmText,
  children,
  variant = "danger",
  className,
}: {
  action: () => Promise<unknown>;
  confirmText: string;
  children: React.ReactNode;
  variant?: ComponentProps<typeof Button>["variant"];
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={() => {
        if (window.confirm(confirmText)) start(async () => void (await action()));
      }}
    >
      {children}
    </Button>
  );
}
