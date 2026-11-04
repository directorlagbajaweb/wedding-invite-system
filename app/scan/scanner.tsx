"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

type Props = {
  /** Called once per decode. The scanner pauses itself until `paused` goes false again. */
  onScan: (text: string) => void;
  paused: boolean;
  /** Bump to resume without a result (e.g. a duplicate scan that was ignored). */
  resumeNonce: number;
};

const SCANNING = 2; // Html5QrcodeScannerState.SCANNING
const PAUSED = 3; // Html5QrcodeScannerState.PAUSED

export function Scanner({ onScan, paused, resumeNonce }: Props) {
  const elementId = `qr-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const qrRef = useRef<Html5Qrcode | null>(null);
  const lockedRef = useRef(false);
  const onScanRef = useRef(onScan);
  const [status, setStatus] = useState<"starting" | "running" | "error">("starting");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let cancelled = false;
    let qr: Html5Qrcode | null = null;

    const starting = (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setErrorText("The camera needs a secure (https) connection. Use Name search instead.");
        return;
      }
      const mod = await import("html5-qrcode");
      if (cancelled) return;

      qr = new mod.Html5Qrcode(elementId, {
        verbose: false,
        formatsToSupport: [mod.Html5QrcodeSupportedFormats.QR_CODE],
      });
      qrRef.current = qr;

      try {
        await qr.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (w, h) => {
              const size = Math.floor(Math.min(w, h) * 0.72);
              return { width: size, height: size };
            },
          },
          (text) => {
            if (lockedRef.current) return;
            lockedRef.current = true;
            try {
              if (qr?.getState() === SCANNING) qr.pause(true);
            } catch {}
            onScanRef.current(text);
          },
          () => {},
        );
        if (!cancelled) setStatus("running");
      } catch (err) {
        if (cancelled) return;
        const msg = String(err);
        setStatus("error");
        setErrorText(
          /NotAllowed|Permission/i.test(msg)
            ? "Camera access was blocked. Allow camera access for this site in your browser settings, then reload."
            : /NotFound|Requested device not found/i.test(msg)
              ? "No camera found on this device. Use Name search instead."
              : "Could not start the camera. Reload the page, or use Name search.",
        );
      }
    })();

    return () => {
      cancelled = true;
      void starting.then(async () => {
        if (!qr) return;
        try {
          if (qr.isScanning) await qr.stop();
          qr.clear();
        } catch {}
      });
      qrRef.current = null;
    };
  }, [elementId]);

  // Resume once the result overlay has closed.
  useEffect(() => {
    if (paused || !lockedRef.current) return;
    const qr = qrRef.current;
    try {
      if (qr?.getState() === PAUSED) qr.resume();
    } catch {}
    lockedRef.current = false;
  }, [paused, resumeNonce]);

  return (
    <div>
      <div className="qr-viewport relative aspect-square w-full overflow-hidden rounded-3xl bg-black">
        <div id={elementId} className="h-full w-full" />
        {status === "starting" ? (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-lg text-white">
            Starting camera&hellip;
          </p>
        ) : null}
        {status === "error" ? (
          <p
            role="alert"
            className="absolute inset-0 flex items-center justify-center bg-neutral px-6 text-center text-lg font-medium text-white"
          >
            {errorText}
          </p>
        ) : null}
      </div>
      <p className="mt-4 text-center text-lg text-ink">
        Point the camera at the guest&rsquo;s QR code.
      </p>
    </div>
  );
}
