
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, GraduationCap, Church, Eye, UserCheck, X, LogIn, UserPlus, Phone } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import ProgressRing from "@/components/church/ProgressRing";
import StatsCard from "@/components/church/StatsCard";

import Header from "@/components/church/Header";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ChuoKikuuFriendsCard, ImpactCard, CallToActionCard, CurrentProjectsCard } from "@/components/church/ExpandableCard";
import PaymentDialog from "@/components/payments/PaymentDialog";
import { usePublicDashboard } from "@/hooks/useChurchData";
import { sendOtp, verifyOtp, signIn, getSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

const ANNUAL_GOAL = 500000; // Configurable church annual goal

const CATEGORIES = [
  { id: "church_member", label: "Church Member", icon: Church, description: "Registered church member", requiresAuth: true },
  { id: "student", label: "Student", icon: GraduationCap, description: "Student member", requiresAuth: true },
  { id: "visitor", label: "Visitor", icon: Eye, description: "First-time or occasional visitor", requiresAuth: false },
  { id: "regular", label: "Regular", icon: UserCheck, description: "Regular attendee", requiresAuth: false },
];

const Index = () => {
  const { data, isLoading } = usePublicDashboard();
  const [showPicker, setShowPicker] = useState(false);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [authDropdown, setAuthDropdown] = useState<"signin" | "signup" | null>(null);
  const [selectedGuestCategory, setSelectedGuestCategory] = useState<string | null>(null);
  const navigate = useNavigate();

  // PWA: auto-open contribute picker when entering from PWA gate
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("pwa_open_picker") === "1") {
      sessionStorage.removeItem("pwa_open_picker");
      setShowPicker(true);
    }
  }, []);

  // Hero slideshow state
  const [currentSlide, setCurrentSlide] = useState(0);
  const heroImages = [
    '/home.1.jpg',
    '/home.2.jpg',
    '/home.3.jpg',
  ];

  // Auto-advance slideshow
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroImages.length]);

  // Auto-redirect authenticated users to dashboard (instant)
  useEffect(() => {
    const session = getSession();
    if (session) {
      navigate("/dashboard", { replace: true });
    }
  }, []); 


  // Auth form state - simplified to match Auth.tsx
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSignup, setIsSignup] = useState(true);
  const [authStep, setAuthStep] = useState<"phone" | "otp" | "password">("phone");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Payment dialog state (replaces all guest payment form state)
  const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; isSimulated: boolean; subtitle?: string }>({
    open: false,
    isSimulated: false,
  });

  const handleCardToggle = (index: number) => {
    setExpandedCard(expandedCard === index ? null : index);
  };

  // Auth handlers using Supabase
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
        // Sign Up: Send OTP
        await sendOtp(phone, fullName.trim());
        setAuthStep("otp");
        setOtpCountdown(300);
        startCountdown();
      } else {
        // Sign In: Direct login with phone only, NO OTP
        const session = await signIn(phone);
        navigate("/dashboard", { replace: true });
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
      const session = await verifyOtp(phone, otp, fullName);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setAuthError(err?.message || "Invalid OTP");
    } finally {
      setAuthLoading(false);
    }
  };

// Back to proven otpService flow with setSession → AuthContext listener → dashboard

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

  const resendOTP = async () => {
    if (otpCountdown > 0) return;
    const e = { preventDefault: () => {} } as React.FormEvent;
    await handlePhoneSubmit(e);
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Payment helper functions


  const resetAuthForm = () => {
    setAuthStep("phone");
    setFullName("");
    setPhone("");
    setOtp("");
    setOtpCountdown(0);
    setAuthError(null);
    setAuthDropdown(null);
  };

  const handleCategoryClick = (category: typeof CATEGORIES[0]) => {
    if (category.requiresAuth) {
      setShowPicker(false);
      setIsSignup(true);
      setAuthDropdown("signup");
    } else {
      setShowPicker(false);
      setSelectedGuestCategory(category.id);
      setPaymentDialog({
        open: true,
        isSimulated: false,
        subtitle: category.id === "visitor" ? "Welcome Visitor!" : "Welcome Regular Attendee!",
      });
    }
  };

const totalCollected = data?.total_collected ?? 0;
  const percentage = ANNUAL_GOAL > 0 ? (totalCollected / ANNUAL_GOAL) * 100 : 0;
  const currentProject = data?.current_project;
  const projectPercentage = currentProject
    ? (currentProject.collected_amount / currentProject.target_amount) * 100
    : 0;
  const bestGroup = data?.best_group;
  const activeMembers = data?.active_members ?? 0;

  // Handle RPC null gracefully
  if (!data) {
    // Early return or loading skeleton could be added here
  }

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Right Sidebar - SDA Logo Only */}
      <aside className="fixed top-16 right-0 h-[calc(100vh-4rem)] w-12 lg:w-20 bg-church-blue z-40 flex flex-col items-center pt-4 lg:pt-6 pb-4 lg:pb-8 px-1 lg:px-3 shadow-xl">
        {/* SDA Logo - With transparent background matching sidebar */}
        <div className="w-8 h-8 lg:w-12 lg:h-12 p-1 flex items-center justify-center">
          <img 
            src="/sdaLogo.png" 
            alt="SDA Logo" 
            className="w-full h-full object-contain"
          />
        </div>
      </aside>

      {/* Main Content with right padding for sidebar */}
      <div className="pr-12 lg:pr-20">
        {/* Hero Section with Slideshow */}
        <section
          className="relative overflow-hidden py-16 sm:py-24"
        >
        {/* Slideshow Background */}
        <div className="absolute inset-0">
          {heroImages.map((image, index) => (
            <motion.div
              key={index}
              className="absolute inset-0"
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ 
                scale: index === currentSlide ? 1 : 1.2,
                opacity: index === currentSlide ? 1 : 0 
              }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              style={{
                backgroundImage: `url(${image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          ))}
          {/* Dark gradient overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-br from-church-blue/90 via-church-blue/85 to-church-blue-dark/90" />
        </div>

        {/* Slideshow Indicators */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {heroImages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-300",
                index === currentSlide 
                  ? "bg-gold w-8" 
                  : "bg-white/40 hover:bg-white/60"
              )}
            />
          ))}
        </div>

        <div className="container mx-auto px-4 relative z-10">
          {/* Church Name Label - Top Left */}
          <div className="absolute top-0 left-4 sm:left-8 md:left-12">
            <p className="text-white/70 text-xs sm:text-sm font-light uppercase tracking-widest">
              Chuo Kikuu SDA Church
            </p>
          </div>

          {/* Main Content - Centered */}
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center pt-16">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-display text-white mb-6 leading-tight"
            >
              Resource Mobilization
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-white/80 text-base sm:text-lg mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              Supporting the Mission of Chuo Kikuu SDA Church by strengthening ministry, empowering spiritual growth, and advancing the work of God through unity, generosity, and faithful service.
            </motion.p>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              onClick={() => setShowPicker(true)}
              className="relative inline-flex items-center gap-2 sm:gap-4 px-5 py-2.5 sm:px-10 sm:py-5 rounded-xl sm:rounded-2xl border border-transparent bg-gradient-to-r from-gold via-amber-500 to-gold font-semibold text-sm sm:text-lg text-white transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] focus:outline-none"
              style={{
                backgroundSize: '200% 100%',
              }}
            >
              <span className="relative tracking-wide">
                Press Here to Contribute
              </span>
            </motion.button>
          </div>
        </div>
      </section>
      </div>

      {/* Expandable Cards Section */}
      <section className="w-full pl-3 pr-14 sm:pl-6 sm:pr-16 md:pl-8 md:pr-20 lg:pl-10 lg:pr-24 xl:pl-12 xl:pr-28 py-10 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto grid w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:max-w-[95%] lg:max-w-[92%] xl:max-w-[1280px]"
        >
          <ChuoKikuuFriendsCard 
            isExpanded={expandedCard === 0} 
            onToggle={() => handleCardToggle(0)} 
            index={0}
          />
          <ImpactCard 
            isExpanded={expandedCard === 1} 
            onToggle={() => handleCardToggle(1)} 
            index={1}
            totalContributed={totalCollected} 
            activeMembers={activeMembers} 
          />
          <CallToActionCard 
            isExpanded={expandedCard === 2} 
            onToggle={() => handleCardToggle(2)} 
            index={2}
            onContributeClick={() => setPaymentDialog({ open: true, isSimulated: false })} 
          />
          <CurrentProjectsCard 
            isExpanded={expandedCard === 3} 
            onToggle={() => handleCardToggle(3)} 
            index={3}
          />
        </motion.div>
      </section>

      {/* Category Picker Modal */}
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
              style={{
                backgroundImage: 'url(/sda_clean_super.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            >
              {/* Dark overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-br from-church-blue/90 via-church-blue/85 to-church-blue-dark/90" />
              
              {/* Content */}
              <div className="relative z-10 p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl sm:text-2xl font-display text-white drop-shadow-lg">I am a...</h2>
                  <button 
                    onClick={() => setShowPicker(false)} 
                    className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                  >
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

      {/* Auth Dropdown - Matching categories dropdown style */}
      <AnimatePresence>
        {authDropdown && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setAuthDropdown(null); resetAuthForm(); }}
          >
            <motion.div
              className="relative w-[90vw] sm:w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundImage: 'url(/sda_clean_super.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            >
              {/* Dark overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-br from-church-blue/90 via-church-blue/85 to-church-blue-dark/90" />
              
              {/* Content */}
              <div className="relative z-10 p-6 sm:p-8">
                <div className="text-center mb-8">
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
                    <button
                      type="button"
                      onClick={() => setIsSignup(true)}
                      className={`px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                        isSignup
                          ? "bg-gold text-primary font-semibold"
                          : "bg-white/20 text-white/70"
                      }`}
                    >
                      <UserPlus className="w-3 h-3" />
                      Sign Up
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSignup(false)}
                      className={`px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                        !isSignup
                          ? "bg-gold text-primary font-semibold"
                          : "bg-white/20 text-white/70"
                      }`}
                    >
                      <LogIn className="w-3 h-3" />
                      Sign In
                    </button>
                  </div>
                )}
              </div>

              {authError && (
                <div className="mb-4 rounded-xl bg-red-500/20 border border-red-300/40 px-4 py-2.5 text-sm text-white text-center backdrop-blur-sm">
                  {authError}
                </div>
              )}

              {authStep === "phone" ? (
                <form onSubmit={handlePhoneSubmit} className="space-y-4">
                  {isSignup && (
                    <Input
                      placeholder="Full Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="h-14 text-lg text-center rounded-2xl bg-white/90 backdrop-blur-sm border-2 border-white/30 focus:border-gold focus:ring-2 focus:ring-gold/30"
                    />
                  )}
                  <Input
                    type="tel"
                    placeholder={isSignup ? "0712345678 or 255712345678" : "0712345678"}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    className="h-14 text-lg text-center rounded-2xl bg-white/90 backdrop-blur-sm border-2 border-white/30 focus:border-gold focus:ring-2 focus:ring-gold/30"
                  />

                  <motion.button
                    type="submit"
                    disabled={authLoading}
                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-gold to-amber-500 text-white font-semibold text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {authLoading ? (
                      <span className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {isSignup ? "Sending OTP..." : "Signing In..."}
                      </span>
                    ) : (
                      isSignup ? "Send OTP" : "Sign In"
                    )}
                  </motion.button>
                </form>
              ) : (
                <form onSubmit={verifyOTP} className="space-y-4">
                  <div className="flex justify-center mb-4">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      className="gap-2"
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} className="h-14 w-12 bg-white/90 backdrop-blur-sm rounded-xl border-2 border-white/30 text-lg font-mono tracking-widest" />
                        <InputOTPSlot index={1} className="h-14 w-12 bg-white/90 backdrop-blur-sm rounded-xl border-2 border-white/30 text-lg font-mono tracking-widest" />
                        <InputOTPSlot index={2} className="h-14 w-12 bg-white/90 backdrop-blur-sm rounded-xl border-2 border-white/30 text-lg font-mono tracking-widest" />
                        <InputOTPSlot index={3} className="h-14 w-12 bg-white/90 backdrop-blur-sm rounded-xl border-2 border-white/30 text-lg font-mono tracking-widest" />
                        <InputOTPSlot index={4} className="h-14 w-12 bg-white/90 backdrop-blur-sm rounded-xl border-2 border-white/30 text-lg font-mono tracking-widest" />
                        <InputOTPSlot index={5} className="h-14 w-12 bg-white/90 backdrop-blur-sm rounded-xl border-2 border-white/30 text-lg font-mono tracking-widest" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <motion.button
                    type="submit"
                    disabled={authLoading || otp.length !== 6}
                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {authLoading ? (
                      <span className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Verifying...
                      </span>
                    ) : (
                      "Continue to Dashboard"
                    )}
                  </motion.button>
                  <div className="flex items-center justify-center gap-2 text-xs text-white/70">
                    <span>Didn't get code?</span>
                    <button
                      type="button"
                      onClick={resendOTP}
                      disabled={otpCountdown > 0 || authLoading}
                      className="text-gold hover:text-gold/80 font-semibold transition-colors disabled:opacity-50"
                    >
                      {otpCountdown > 0 ? formatCountdown(otpCountdown) : "Resend"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthStep("phone");
                      setFullName("");
                      setPhone("");
                      setOtp("");
                    }}
                    className="w-full text-white/70 hover:text-white text-sm transition-colors py-2"
                  >
                    Change Details
                  </button>
                </form>
              )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified Payment Dialog (replaces old guest payment dropdown) */}
      <PaymentDialog
        open={paymentDialog.open}
        onClose={() => setPaymentDialog({ open: false, isSimulated: false })}
        userId={null}
        isSimulated={paymentDialog.isSimulated}
        title="Make a Contribution"
        subtitle={paymentDialog.subtitle ?? "Chuo Kikuu SDA Church"}
      />

      {/* Footer */}
      <footer className="bg-church-blue border-t border-church-blue-dark py-8 pr-12 lg:pr-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h3 className="text-white font-display text-lg mb-2">Seventh Day Adventist Church CHUO KIKUU</h3>
            <p className="text-white/70 text-sm">
              © Copyright @2026 CHUO KIKUU SDA CHURCH
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
