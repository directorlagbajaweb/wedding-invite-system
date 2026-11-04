import { Amp, CardShell, GoldRule } from "../card-shell";

export default function InviteNotFound() {
  return (
    <CardShell>
      <p className="font-script text-5xl leading-tight">Racheal <Amp /> Christian</p>
      <GoldRule className="my-8" />
      <h1 className="text-xl font-medium">We couldn&rsquo;t find this invitation.</h1>
      <p className="mt-3 text-muted italic">
        Please check the link you received.
      </p>
    </CardShell>
  );
}
