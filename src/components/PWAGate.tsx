import { useEffect, useState } from "react";
import { isStandalonePWA } from "@/lib/pwa";
import PaymentDialog from "@/components/payments/PaymentDialog";

/**
 * Gate shown ONLY when the app is launched as an installed PWA
 * (display-mode: standalone). Browser/website users bypass this entirely.
 *
 * PWA flow:
 *   1. Splash (logo + "Chuo Kikuu SDA Church") ~2s — ALWAYS on launch
 *   2. "Press Here to Contribute" screen (persistent home of the PWA)
 *   3. Tapping the button opens the PaymentDialog directly.
 *      Closing the dialog returns to the contribute screen — never the website.
 *
 * The website's landing page / children are never rendered inside the PWA.
 */
export default function PWAGate({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [payOpen, setPayOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isPwa = isStandalonePWA();
    setStandalone(isPwa);
    if (isPwa) {
      // Always show splash on every fresh launch of the PWA.
      const t = setTimeout(() => setShowSplash(false), 2000);
      return () => clearTimeout(t);
    }
  }, []);

  if (!mounted) return <>{children}</>;
  if (!standalone) return <>{children}</>;

  const bg =
    "radial-gradient(ellipse at top, #1a2238 0%, #0b0f1a 60%, #05070d 100%)";

  if (showSplash) {
    return (
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: bg,
          color: "white",
          padding: "2rem",
          textAlign: "center",
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        }}
      >
        <img
          src="/sdaLogo.png"
          alt="Chuo Kikuu SDA Church"
          style={{
            width: 128,
            height: 128,
            marginBottom: 24,
            borderRadius: 24,
            animation: "pwaPulse 1.6s ease-in-out infinite",
          }}
        />
        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0 }}>
          Chuo Kikuu SDA Church
        </h1>
        <p style={{ opacity: 0.7, marginTop: 8, fontSize: "0.9rem" }}>
          Resource Mobilization
        </p>
        <style>{`
          @keyframes pwaPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.06); opacity: 0.9; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: bg,
        color: "white",
        padding: "2rem",
        textAlign: "center",
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <img
        src="/sdaLogo.png"
        alt="Chuo Kikuu SDA Church"
        style={{ width: 96, height: 96, marginBottom: 20, borderRadius: 16 }}
      />
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 6 }}>
        Chuo Kikuu SDA Church
      </h1>
      <p
        style={{
          opacity: 0.7,
          marginBottom: 40,
          maxWidth: 320,
          lineHeight: 1.5,
          fontSize: "0.95rem",
        }}
      >
        Tap below to make your contribution.
      </p>
      <button
        onClick={() => setPayOpen(true)}
        style={{
          padding: "16px 32px",
          borderRadius: 16,
          border: "none",
          background: "linear-gradient(90deg, #d4af37, #f5c842, #d4af37)",
          color: "white",
          fontSize: "1.05rem",
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 10px 30px rgba(212, 175, 55, 0.35)",
          letterSpacing: "0.02em",
        }}
      >
        Press Here to Contribute
      </button>

      <PaymentDialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        userId={null}
        isSimulated={false}
      />
    </div>
  );
}
