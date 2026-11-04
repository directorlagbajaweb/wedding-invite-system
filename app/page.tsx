import { Amp, CardShell, GoldRule } from "./invite/card-shell";

export default function Home() {
  return (
    <CardShell>
      <p className="font-script text-5xl leading-tight">Racheal <Amp /> Christian</p>
      <GoldRule className="my-8" />
      <p className="text-muted italic">
        Please open the personal invitation link you received.
      </p>
    </CardShell>
  );
}
