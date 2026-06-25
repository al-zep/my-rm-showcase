interface SplashScreenProps {
  label?: string;
}

/**
 * Reusable startup splash screen.
 * Used on PWA launch AND as the loading transition when
 * entering the dashboard or signing out.
 */
export default function SplashScreen({ label = "Resource Mobilization" }: SplashScreenProps) {
  const bg = "radial-gradient(ellipse at top, #1a2238 0%, #0b0f1a 60%, #05070d 100%)";
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
      <p style={{ opacity: 0.7, marginTop: 8, fontSize: "0.9rem" }}>{label}</p>
      <div
        style={{
          marginTop: 28,
          width: 36,
          height: 36,
          border: "3px solid rgba(255,255,255,0.15)",
          borderTopColor: "#f4c542",
          borderRadius: "50%",
          animation: "pwaSpin 0.9s linear infinite",
        }}
      />
      <style>{`
        @keyframes pwaPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.06); opacity: 0.9; }
        }
        @keyframes pwaSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
