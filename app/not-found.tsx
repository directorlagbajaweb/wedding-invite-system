import { Amp, CardShell, GoldRule } from "./invite/card-shell";

export default function NotFound() {
  return (
    <CardShell>
      <p className="font-script text-5xl leading-tight">Racheal <Amp /> Christian</p>
      <GoldRule className="my-8" />
      <h1 className="text-xl font-medium">We couldn&rsquo;t find this page.</h1>
      <p className="mt-3 text-muted italic">
        Please check the link you received.
      </p>
    </CardShell>
  );
}
