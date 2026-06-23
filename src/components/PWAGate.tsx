import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Church, Eye, GraduationCap, LogIn, Phone, UserCheck, UserPlus, X } from "lucide-react";
import { isPWAEntryExperience } from "@/lib/pwa";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { sendOtp, signIn, verifyOtp } from "@/lib/auth";
import PaymentDialog from "@/components/payments/PaymentDialog";

const CATEGORIES = [
  { id: "church_member", label: "Church Member", icon: Church, description: "Registered church member", requiresAuth: true },
  { id: "student", label: "Student", icon: GraduationCap, description: "Student member", requiresAuth: true },
  { id: "visitor", label: "Visitor", icon: Eye, description: "First-time or occasional visitor", requiresAuth: false },
  { id: "regular", label: "Regular", icon: UserCheck, description: "Regular attendee", requiresAuth: false },
];

/**
 * Gate shown ONLY when the app is launched as an installed PWA
 * (display-mode: standalone). Browser/website users bypass this entirely.
 *
 * PWA flow:
 *   1. Splash (logo + "Chuo Kikuu SDA Church") ~2s — ALWAYS on launch
 *   2. "Press Here to Contribute" screen (persistent home of the PWA)
 *   3. Tapping the button opens the existing "I am a..." picker flow.
 *      Closing any dropdown returns to the contribute screen — never the website.
 *
 * The website's landing page / children are never rendered inside the PWA.
 */
export default function PWAGate({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [pwaMode, setPwaMode] = useState(() => isPWAEntryExperience());
  const [showSplash, setShowSplash] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [authDropdown, setAuthDropdown] = useState<"signin" | "signup" | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentTitle, setPaymentTitle] = useState("Make a Contribution");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSignup, setIsSignup] = useState(true);
  const [authStep, setAuthStep] = useState<"phone" | "otp" | "password">("phone");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);

  useEffect(() => {
    setMounted(true);
    const isPwa = isPWAEntryExperience();
    setPwaMode(isPwa);
    if (isPwa) {
      // Always show splash on every fresh launch of the PWA.
      const t = setTimeout(() => setShowSplash(false), 2000);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.classList.remove("pwa-booting");
    }
  }, [mounted, pwaMode]);

  if (!mounted && !pwaMode) return <>{children}</>;
  if (!pwaMode) return <>{children}</>;

  const resetAuthForm = () => {
    setAuthStep("phone");
    setFullName("");
    setPhone("");
    setOtp("");
    setOtpCountdown(0);
    setAuthError(null);
    setAuthDropdown(null);
  };

  const startCountdown = () => {
    const countdown = setInterval(() => {
      setOtpCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdown);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCategoryClick = (category: typeof CATEGORIES[0]) => {
    setShowPicker(false);
    if (!category.requiresAuth) {
      // Visitors & Regulars go straight to payment form — no sign in/up
      setPaymentTitle(`${category.label} Contribution`);
      setShowPayment(true);
      return;
    }
    setIsSignup(category.requiresAuth);
    setAuthDropdown(category.requiresAuth ? "signup" : "signin");
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (phone.length < 10) {
      setAuthError("Enter valid phone (10+ digits)");
      return;
    }
    if (isSignup && !fullName.trim()) {
      setAuthError("Enter your full name for signup");
      return;
    }
    setAuthLoading(true);
    try {
      if (isSignup) {
        await sendOtp(phone, fullName.trim());
        setAuthStep("otp");
        setOtpCountdown(300);
        startCountdown();
      } else {
        await signIn(phone);
        window.location.assign("/dashboard");
      }
    } catch (err: any) {
      setAuthError(err?.message || (isSignup ? "Failed to send OTP" : "Failed to sign in"));
    } finally {
      setAuthLoading(false);
    }
  };

  const verifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (otp.length !== 6) {
      setAuthError("Enter 6-digit OTP");
      return;
    }
    setAuthLoading(true);
    try {
      await verifyOtp(phone, otp, fullName);
      window.location.assign("/dashboard");
    } catch (err: any) {
      setAuthError(err?.message || "Invalid OTP");
    } finally {
      setAuthLoading(false);
    }
  };

  const resendOTP = async () => {
    if (otpCountdown > 0) return;
    const e = { preventDefault: () => {} } as React.FormEvent;
    await handlePhoneSubmit(e);
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

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
        style={{ width: 128, height: 128, marginBottom: 24, borderRadius: 24 }}
      />
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0 }}>
        Chuo Kikuu SDA Church
      </h1>
      <p style={{ opacity: 0.7, marginTop: 8, marginBottom: 40, fontSize: "0.9rem" }}>
        Resource Mobilization
      </p>
      <button
        onClick={() => setShowPicker(true)}
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

      <AnimatePresence>
        {showPicker && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPicker(false)}
          >
            <motion.div
              className="relative w-[90vw] sm:w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{ backgroundImage: "url(/sda_clean_super.png)", backgroundSize: "cover", backgroundPosition: "center" }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-church-blue/90 via-church-blue/85 to-church-blue-dark/90" />
              <div className="relative z-10 p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl sm:text-2xl font-display text-white drop-shadow-lg">I am a...</h2>
                  <button aria-label="Close category picker" onClick={() => setShowPicker(false)} className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {CATEGORIES.map((cat) => (
                    <motion.button
                      key={cat.id}
                      onClick={() => handleCategoryClick(cat)}
                      className="flex items-center gap-4 p-4 rounded-xl bg-white/95 hover:bg-white border border-white/20 hover:border-white/40 transition-all text-left group backdrop-blur-sm"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="w-12 h-12 rounded-lg bg-church-blue/10 flex items-center justify-center group-hover:bg-church-blue/20 transition-colors">
                        <cat.icon className="w-6 h-6 text-church-blue" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{cat.label}</p>
                        <p className="text-xs text-muted-foreground">{cat.description}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto group-hover:text-church-blue transition-colors" />
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {authDropdown && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={resetAuthForm}
          >
            <motion.div
              className="relative w-[90vw] sm:w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{ backgroundImage: "url(/sda_clean_super.png)", backgroundSize: "cover", backgroundPosition: "center" }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-church-blue/90 via-church-blue/85 to-church-blue-dark/90" />
              <div className="relative z-10 p-6 sm:p-8">
                <div className="flex items-start justify-between mb-6">
                  <div className="text-center flex-1">
                    <div className="w-16 h-16 mx-auto mb-4 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-xl">
                      <Phone className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">
                      {authStep === "otp" ? "Enter Code" : isSignup ? "Sign Up" : "Sign In"}
                    </h1>
                    <p className="text-white/80 text-sm drop-shadow-lg">
                      {authStep === "otp" ? `OTP sent to ${phone}. Enter code to continue.` : isSignup ? "Enter name and phone to receive OTP" : "Enter phone to sign in directly"}
                    </p>
                    {authStep === "phone" && (
                      <div className="flex items-center justify-center gap-2 mt-4">
                        <button type="button" onClick={() => setIsSignup(true)} className={`px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${isSignup ? "bg-gold text-primary font-semibold" : "bg-white/20 text-white/70"}`}>
                          <UserPlus className="w-3 h-3" /> Sign Up
                        </button>
                        <button type="button" onClick={() => setIsSignup(false)} className={`px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${!isSignup ? "bg-gold text-primary font-semibold" : "bg-white/20 text-white/70"}`}>
                          <LogIn className="w-3 h-3" /> Sign In
                        </button>
                      </div>
                    )}
                  </div>
                  <button aria-label="Close login form" onClick={resetAuthForm} className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {authError && <div className="mb-4 rounded-xl bg-red-500/20 border border-red-300/40 px-4 py-2.5 text-sm text-white text-center backdrop-blur-sm">{authError}</div>}

                {authStep === "phone" ? (
                  <form onSubmit={handlePhoneSubmit} className="space-y-4">
                    {isSignup && <Input placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-14 text-lg text-center rounded-2xl bg-white/90 backdrop-blur-sm border-2 border-white/30 focus:border-gold focus:ring-2 focus:ring-gold/30" />}
                    <Input type="tel" placeholder={isSignup ? "0712345678 or 255712345678" : "0712345678"} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} className="h-14 text-lg text-center rounded-2xl bg-white/90 backdrop-blur-sm border-2 border-white/30 focus:border-gold focus:ring-2 focus:ring-gold/30" />
                    <motion.button type="submit" disabled={authLoading} className="w-full h-14 rounded-2xl bg-gradient-to-r from-gold to-amber-500 text-white font-semibold text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      {authLoading ? (isSignup ? "Sending OTP..." : "Signing In...") : isSignup ? "Send OTP" : "Sign In"}
                    </motion.button>
                  </form>
                ) : (
                  <form onSubmit={verifyOTP} className="space-y-4">
                    <div className="flex justify-center mb-4">
                      <InputOTP value={otp} onChange={setOtp} maxLength={6} className="gap-2">
                        <InputOTPGroup>
                          {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} className="h-14 w-12 bg-white/90 backdrop-blur-sm rounded-xl border-2 border-white/30 text-lg font-mono tracking-widest" />)}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    <motion.button type="submit" disabled={authLoading || otp.length !== 6} className="w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      {authLoading ? "Verifying..." : "Continue to Dashboard"}
                    </motion.button>
                    <div className="flex items-center justify-center gap-2 text-xs text-white/70">
                      <span>Didn't get code?</span>
                      <button type="button" onClick={resendOTP} disabled={otpCountdown > 0 || authLoading} className="text-gold hover:text-gold/80 font-semibold transition-colors disabled:opacity-50">
                        {otpCountdown > 0 ? formatCountdown(otpCountdown) : "Resend"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
