"use client";

import { useCallback, useState } from "react";
import { whatsAppLink } from "@/lib/phone";

export const btnPrimary =
  "inline-flex h-11 items-center justify-center rounded-full bg-gold px-5 text-sm font-semibold text-white hover:bg-[#a67a43] disabled:cursor-not-allowed disabled:opacity-50";
export const btnSecondary =
  "inline-flex h-11 items-center justify-center rounded-full border border-gold px-5 text-sm font-semibold text-ink hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40";
export const btnSmall =
  "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-full border border-gold px-3.5 text-sm font-medium text-ink hover:bg-paper disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";
export const input =
  "h-11 w-full rounded-xl border border-hairline bg-white px-3.5 text-ink placeholder:text-muted focus:border-gold focus:outline-none";
export const card = "rounded-2xl border border-hairline bg-card p-6";

export function inviteLink(siteUrl: string, code: string) {
  return `${siteUrl}/invite/${code}`;
}

const lagos = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatArrival(iso: string): string {
  return lagos.format(new Date(iso)).replace(/\s?(am|pm)/i, (m) => m.trim().toLowerCase());
}

export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback(async (text: string, key: string = text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(key);
    window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  }, []);
  return { copied, copy };
}

export function WhatsAppButton({
  phone,
  name,
  url,
  className = btnSmall,
}: {
  phone: string | null;
  name: string;
  url: string | null;
  className?: string;
}) {
  const href = url ? whatsAppLink(phone, name, url) : null;
  if (!href) {
    return (
      <button
        type="button"
        disabled
        className={className}
        title={!url ? "No invite code" : "No usable phone number"}
      >
        WhatsApp
      </button>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      WhatsApp
    </a>
  );
}

/** Shows the link for a newly created or assigned e-invite. */
export function NewInviteLink({
  name,
  phone,
  url,
}: {
  name: string;
  phone: string | null;
  url: string;
}) {
  const { copied, copy } = useCopy();
  return (
    <div className="mt-4 rounded-xl border border-hairline bg-white p-4" role="status">
      <p className="text-sm text-muted">Invite link for {name}</p>
      <p className="mt-1 font-mono text-sm break-all">{url}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={btnSmall} onClick={() => copy(url)}>
          {copied ? "Copied" : "Copy link"}
        </button>
        <WhatsAppButton phone={phone} name={name} url={url} />
      </div>
    </div>
  );
}
