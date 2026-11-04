import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import QRCode from "qrcode";
import { getSupabase } from "@/lib/supabase";
import { inviteUrl, normaliseCode } from "@/lib/codes";
import { Amp, CardShell, GoldRule } from "../card-shell";
import { Invitation } from "./invitation";

export const metadata: Metadata = {
  title: "You’re invited · Racheal & Christian",
};

export default function InvitePage({ params }: PageProps<"/invite/[code]">) {
  return (
    <Suspense fallback={<LoadingCard />}>
      <InviteLoader params={params} />
    </Suspense>
  );
}

async function InviteLoader({
  params,
}: {
  params: PageProps<"/invite/[code]">["params"];
}) {
  const { code: rawCode } = await params;
  const code = normaliseCode(rawCode);
  if (!code) notFound();

  const { data, error } = await getSupabase()
    .from("guests")
    .select("name, code")
    .eq("code", code)
    .neq("type", "printed")
    .maybeSingle();

  if (error) throw new Error("Could not load invitation");
  if (!data?.code) notFound();

  const qrDataUrl = await QRCode.toDataURL(inviteUrl(data.code), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 440, // rendered at 220px, 2x for sharp screens
    color: { dark: "#4B2A1E", light: "#FFFFFF" },
  });

  return (
    <Invitation
      name={data.name?.trim() || "Guest"}
      code={data.code}
      qrDataUrl={qrDataUrl}
      joyUrl={process.env.JOY_URL ?? ""}
    />
  );
}

function LoadingCard() {
  return (
    <CardShell>
      <p className="font-script text-5xl leading-tight">Racheal <Amp /> Christian</p>
      <GoldRule className="my-8" />
      <p className="text-muted italic" role="status">
        Preparing your invitation&hellip;
      </p>
    </CardShell>
  );
}
