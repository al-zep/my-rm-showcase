import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, X, Loader2, Phone, Building2, ExternalLink } from "lucide-react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { getSession } from "@/lib/auth";

import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

type PaymentType = "mobile_money" | "bank";
type PaymentState = "form" | "sending" | "pending" | "awaiting_bank" | "success" | "error";

const mobileMoneyMethods = [
  { id: "mpesa", name: "M-Pesa" },
  { id: "tigopesa", name: "Tigo Pesa" },
  { id: "airtel", name: "Airtel Money" },
  { id: "halopesa", name: "HaloPesa" },
];

const formatPhoneNumber = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 12);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
};

const formatCurrency = (amt: number): string => amt.toLocaleString("en-TZ");

const openCenteredPopup = (url: string, name: string, w = 480, h = 720): Window | null => {
  const dualLeft = window.screenLeft ?? window.screenX ?? 0;
  const dualTop = window.screenTop ?? window.screenY ?? 0;
  const width = window.innerWidth || document.documentElement.clientWidth || screen.width;
  const height = window.innerHeight || document.documentElement.clientHeight || screen.height;
  const left = dualLeft + (width - w) / 2;
  const top = dualTop + (height - h) / 2;
  return window.open(
    url,
    name,
    `scrollbars=yes,resizable=yes,width=${w},height=${h},top=${top},left=${left}`,
  );
};

interface PaymentFormProps {
  userId?: string | null;
  /** Demo mode: skip ClickPesa call (used by guest dashboard preview) */
  isSimulated?: boolean;
}

const REFERENCE_OPTIONS = [
  { value: "Zaka", label: "Zaka" },
  { value: "Sadaka", label: "Sadaka" },
  { value: "RM", label: "RM" },
  { value: "Other", label: "Other" },
];

const PaymentForm = ({ userId = null, isSimulated = false }: PaymentFormProps) => {
  const [paymentType, setPaymentType] = useState<PaymentType>("mobile_money");
  const [phone, setPhone] = useState("");
  const [reference, setReference] = useState("");
  const [referenceOther, setReferenceOther] = useState("");
  const [amount, setAmount] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [selectedMobileMethod, setSelectedMobileMethod] = useState<string | null>(null);

  const [paymentState, setPaymentState] = useState<PaymentState>("form");
  const [errorMsg, setErrorMsg] = useState("");
  const [successSummary, setSuccessSummary] = useState<{ amount: number; type: PaymentType; method?: string | null } | null>(null);
  const [activeOrderRef, setActiveOrderRef] = useState<string | null>(null);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);

  const popupRef = useRef<Window | null>(null);
  const pollingRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneNumber(e.target.value));
  }, []);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value.replace(/[^0-9]/g, ""));
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current !== null) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      stopPolling();
      try { popupRef.current?.close(); } catch { /* ignore */ }
    };
  }, [stopPolling]);

  const fireConfetti = () => {
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ["#d4a017", "#2d8a56", "#7c3aed"] });
  };

  const checkStatusOnce = async (orderReference: string): Promise<string | null> => {
    const supabase = createSupabaseClient(getSession()?.access_token);
    try {
      const { data, error } = await supabase.functions.invoke("clickpesa-status", {
        body: { orderReference },
      });
      if (error) return null;
      return (data as { status?: string } | null)?.status ?? null;
    } catch {
      return null;
    }
  };

  const startPolling = (orderReference: string, type: PaymentType, methodLabel: string | null, numericAmount: number) => {
    stopPolling();
    let attempts = 0;
    const maxAttempts = 90; // ~6 mins at 4s
    pollingRef.current = window.setInterval(async () => {
      if (cancelledRef.current) return;
      attempts += 1;
      const status = await checkStatusOnce(orderReference);

      if (status === "success") {
        stopPolling();
        try { popupRef.current?.close(); } catch { /* ignore */ }
        setSuccessSummary({ amount: numericAmount, type, method: methodLabel });
        setPaymentState("success");
        fireConfetti();
        
        return;
      }
      if (status === "failed" || status === "reversed") {
        stopPolling();
        try { popupRef.current?.close(); } catch { /* ignore */ }
        setPaymentState("error");
        setErrorMsg(`Payment ${status}. Please try again.`);
        return;
      }
      if (attempts >= maxAttempts) {
        stopPolling();
        setPaymentState("error");
        setErrorMsg("We didn't receive a confirmation in time. Please check shortly.");
      }
    }, 4000);
  };

  const reset = () => {
    cancelledRef.current = false;
    stopPolling();
    try { popupRef.current?.close(); } catch { /* ignore */ }
    popupRef.current = null;
    setPaymentState("form");
    setPhone("");
    setReference("");
    setReferenceOther("");
    setAmount("");
    setSelectedMobileMethod(null);
    setErrorMsg("");
    setSuccessSummary(null);
    setActiveOrderRef(null);
    setPaymentLink(null);
  };

  const cancelActivePayment = () => {
    stopPolling();
    try { popupRef.current?.close(); } catch { /* ignore */ }
    popupRef.current = null;
    setPaymentState("form");
  };

  const checkNow = async () => {
    if (!activeOrderRef) return;
    const status = await checkStatusOnce(activeOrderRef);
    if (status === "success") {
      stopPolling();
      try { popupRef.current?.close(); } catch { /* ignore */ }
      const numericAmount = parseInt(amount, 10);
      setSuccessSummary({ amount: numericAmount, type: paymentType, method: selectedMobileMethod });
      setPaymentState("success");
      fireConfetti();
    } else if (status === "failed" || status === "reversed") {
      stopPolling();
      setPaymentState("error");
      setErrorMsg(`Payment ${status}.`);
    }
  };

  const finalReference =
    reference === "Other" ? referenceOther.trim() : reference;

  const handleSubmit = async () => {
    const numericAmount = parseInt(amount, 10);
    if (!numericAmount || numericAmount < 500 || numericAmount > 3_000_000) {
      setErrorMsg("Enter a valid amount (TZS 500 – 3,000,000)");
      return;
    }

    if (!reference) {
      setErrorMsg("Please select a reference (Zaka, Sadaka, RM or Other)");
      return;
    }
    if (reference === "Other" && !referenceOther.trim()) {
      setErrorMsg("Please describe your reference");
      return;
    }

    setErrorMsg("");

    // ============ BANK FLOW ============
    if (paymentType === "bank") {
      setPaymentState("sending");

      // Demo mode
      if (isSimulated) {
        await new Promise((r) => setTimeout(r, 1200));
        setSuccessSummary({ amount: numericAmount, type: "bank", method: "Bank" });
        setPaymentState("success");
        fireConfetti();
        return;
      }

      try {
        const supabase = createSupabaseClient(getSession()?.access_token);
        const { data, error } = await supabase.functions.invoke("clickpesa-checkout", {
          body: {
            amount: numericAmount,
            userId: userId ?? null,
            reference: finalReference || null,
            customerName: customerName || null,
          },
        });

        if (error || !(data as { success?: boolean } | null)?.success) {
          const msg = (data as { error?: string } | null)?.error || error?.message || "Failed to start payment";
          setPaymentState("error");
          setErrorMsg(msg);
          return;
        }

        const { orderReference, paymentLink: link } = data as { orderReference: string; paymentLink: string };
        setActiveOrderRef(orderReference);
        setPaymentLink(link);

        // Open popup
        const popup = openCenteredPopup(link, "clickpesa-checkout");
        popupRef.current = popup;
        if (!popup) {
          setErrorMsg("Popup blocked. Use the 'Open payment page' button below.");
        }

        setPaymentState("awaiting_bank");
        startPolling(orderReference, "bank", "Bank", numericAmount);
      } catch (err) {
        setPaymentState("error");
        setErrorMsg(err instanceof Error ? err.message : "Unexpected error");
      }
      return;
    }

    // ============ MOBILE MONEY FLOW (USSD push) ============
    const cleanPhone = phone.replace(/\s/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMsg("Enter a valid phone number");
      return;
    }
    if (!selectedMobileMethod) {
      setErrorMsg("Select a mobile money provider");
      return;
    }

    setPaymentState("sending");

    if (isSimulated) {
      await new Promise((r) => setTimeout(r, 1500));
      setSuccessSummary({ amount: numericAmount, type: "mobile_money", method: selectedMobileMethod });
      setPaymentState("success");
      fireConfetti();
      return;
    }

    try {
      const supabase = createSupabaseClient(getSession()?.access_token);
      const { data, error } = await supabase.functions.invoke("clickpesa-initiate", {
        body: {
          amount: numericAmount,
          phone: cleanPhone,
          userId: userId ?? null,
          reference: finalReference || null,
        },
      });

      if (error || !(data as { success?: boolean } | null)?.success) {
        const msg = (data as { error?: string } | null)?.error || error?.message || "Failed to start payment";
        setPaymentState("error");
        setErrorMsg(msg);
        return;
      }

      const orderReference = (data as { orderReference: string }).orderReference;
      setActiveOrderRef(orderReference);
      setPaymentState("pending");
      startPolling(orderReference, "mobile_money", selectedMobileMethod, numericAmount);
    } catch (err) {
      setPaymentState("error");
      setErrorMsg(err instanceof Error ? err.message : "Unexpected error");
    }
  };

  // ============ AWAITING BANK STATE (popup open) ============
  if (paymentState === "awaiting_bank") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-3">
        <div className="relative w-20 h-20 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400/30 to-purple-500/30 animate-ping" />
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-xl">
            <Building2 className="w-9 h-9 text-white" />
          </div>
        </div>
        <h2 className="text-lg font-display text-white mb-1">Waiting for bank confirmation...</h2>
        <p className="text-xs text-white/70 mb-4 px-2">
          Complete the payment in the popup window. We'll detect it automatically.
        </p>

        <div className="bg-white/10 rounded-xl p-3 mb-4 border border-white/10">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/60">Amount</span>
            <span className="font-semibold text-gold-light">TZS {formatCurrency(parseInt(amount, 10) || 0)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Reference</span>
            <span className="font-mono text-white/80 text-[10px]">{activeOrderRef}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mb-4">
          <Loader2 className="w-4 h-4 text-gold animate-spin" />
          <span className="text-xs text-white/70">Polling status every 4s</span>
        </div>

        <div className="space-y-2">
          {paymentLink && (
            <a
              href={paymentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-10 rounded-xl border border-white/20 text-white text-xs font-medium flex items-center justify-center gap-2 hover:bg-white/10 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open payment page
            </a>
          )}
          <button
            onClick={checkNow}
            className="w-full h-10 rounded-xl gradient-gold text-primary-foreground text-xs font-semibold"
          >
            I have completed payment
          </button>
          <button
            onClick={cancelActivePayment}
            className="w-full h-9 rounded-xl text-white/70 text-xs hover:text-white"
          >
            Cancel payment
          </button>
        </div>
      </motion.div>
    );
  }

  // SUCCESS
  if (paymentState === "success" && successSummary) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-display text-white mb-2">Contribution Received!</h2>
        <p className="text-xs text-white/70 mb-4">Asante kwa mchango wako. Mungu akubariki!</p>
        <div className="bg-white/10 rounded-xl p-3 mb-4 text-left border border-white/10">
          <div className="flex justify-between py-1.5 text-xs">
            <span className="text-white/60">Amount</span>
            <span className="font-semibold text-gold-light">TZS {formatCurrency(successSummary.amount)}</span>
          </div>
          <div className="flex justify-between py-1.5 text-xs">
            <span className="text-white/60">Method</span>
            <span className="font-semibold text-white">{successSummary.type === "bank" ? "Bank" : "Mobile Money"}</span>
          </div>
        </div>
        <button onClick={reset} className="w-full py-2.5 rounded-xl gradient-gold text-primary-foreground font-semibold text-sm shadow-lg">
          Make Another Contribution
        </button>
      </motion.div>
    );
  }

  // ERROR
  if (paymentState === "error") {
    return (
      <div className="text-center py-4">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/30 flex items-center justify-center">
          <X className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-display text-white mb-2">Payment Failed</h2>
        <p className="text-xs text-white/70 mb-4 break-words">{errorMsg}</p>
        <button onClick={reset} className="w-full py-2.5 rounded-xl gradient-gold text-primary-foreground font-semibold text-sm shadow-lg">
          Try Again
        </button>
      </div>
    );
  }

  // FORM + processing banners
  return (
    <div className="space-y-3">
      {paymentState === "sending" && (
        <div className="bg-white/10 rounded-xl p-3 border border-white/10 text-center">
          <Loader2 className="w-6 h-6 mx-auto mb-2 text-gold animate-spin" />
          <p className="text-white text-sm">Preparing payment...</p>
        </div>
      )}
      {paymentState === "pending" && (
        <div className="bg-white/10 rounded-xl p-3 border border-gold/30 text-center">
          <Phone className="w-6 h-6 mx-auto mb-2 text-emerald-400" />
          <p className="text-white text-sm font-medium">Check your phone</p>
          <p className="text-white/60 text-xs">Enter PIN to confirm. We'll auto-detect it.</p>
          <button onClick={cancelActivePayment} className="mt-2 text-xs text-white/60 hover:text-white underline">
            Cancel
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-xl bg-white/10 p-1 border border-white/10">
        <button
          type="button"
          onClick={() => setPaymentType("mobile_money")}
          disabled={paymentState !== "form"}
          className={cn(
            "flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all",
            paymentType === "mobile_money" ? "bg-white text-primary shadow-md" : "text-white/70 hover:text-white"
          )}
        >
          Mobile Money
        </button>
        <button
          type="button"
          onClick={() => setPaymentType("bank")}
          disabled={paymentState !== "form"}
          className={cn(
            "flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all",
            paymentType === "bank" ? "bg-white text-primary shadow-md" : "text-white/70 hover:text-white"
          )}
        >
          Bank / Card
        </button>
      </div>

      <AnimatePresence mode="wait">
        {paymentType === "mobile_money" ? (
          <motion.div
            key="mm"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs sm:text-sm font-semibold text-white">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="2557XXXXXXXX"
                disabled={paymentState !== "form"}
                className="w-full h-10 sm:h-11 mt-1 px-3 rounded-xl border-2 bg-white/95 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 border-border/50 focus:border-gold disabled:opacity-60"
                maxLength={16}
                inputMode="numeric"
              />
            </div>

            <div>
              <label className="text-xs sm:text-sm font-semibold text-white">Reference</label>
              <select
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                disabled={paymentState !== "form"}
                className="w-full h-10 sm:h-11 mt-1 px-3 rounded-xl border-2 bg-white/95 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 border-border/50 focus:border-gold disabled:opacity-60"
              >
                <option value="">-- Select reference --</option>
                {REFERENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {reference === "Other" && (
                <input
                  type="text"
                  value={referenceOther}
                  onChange={(e) => setReferenceOther(e.target.value)}
                  placeholder="Describe your reference"
                  disabled={paymentState !== "form"}
                  maxLength={100}
                  className="w-full h-10 sm:h-11 mt-2 px-3 rounded-xl border-2 bg-white/95 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 border-border/50 focus:border-gold disabled:opacity-60"
                />
              )}
            </div>

            <div>
              <label className="text-xs sm:text-sm font-semibold text-white">Provider</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {mobileMoneyMethods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMobileMethod(m.id)}
                    disabled={paymentState !== "form"}
                    className={cn(
                      "relative p-2 rounded-lg border-2 transition-all text-center",
                      selectedMobileMethod === m.id
                        ? "border-gold bg-gold/10"
                        : "border-white/20 bg-white/5 hover:border-white/40"
                    )}
                  >
                    <span className="font-medium text-white text-xs">{m.name}</span>
                    {selectedMobileMethod === m.id && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gold flex items-center justify-center">
                        <CheckCircle2 className="w-2.5 h-2.5 text-primary" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="bank"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-3"
          >
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-start gap-2">
              <Building2 className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
              <div className="text-xs text-white/70 leading-relaxed">
                A secure popup will open where you can pay using <strong className="text-white">CRDB, NMB, NBC, Equity, cards</strong> and more. Your bank credentials are never seen by us.
              </div>
            </div>

            <div>
              <label className="text-xs sm:text-sm font-semibold text-white">
                Your Name <span className="text-white/40 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Full name"
                disabled={paymentState !== "form"}
                maxLength={80}
                className="w-full h-10 sm:h-11 mt-1 px-3 rounded-xl border-2 bg-white/95 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 border-border/50 focus:border-gold disabled:opacity-60"
              />
            </div>

            <div>
              <label className="text-xs sm:text-sm font-semibold text-white">Reference</label>
              <select
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                disabled={paymentState !== "form"}
                className="w-full h-10 sm:h-11 mt-1 px-3 rounded-xl border-2 bg-white/95 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 border-border/50 focus:border-gold disabled:opacity-60"
              >
                <option value="">-- Select reference --</option>
                {REFERENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {reference === "Other" && (
                <input
                  type="text"
                  value={referenceOther}
                  onChange={(e) => setReferenceOther(e.target.value)}
                  placeholder="Describe your reference"
                  disabled={paymentState !== "form"}
                  maxLength={100}
                  className="w-full h-10 sm:h-11 mt-2 px-3 rounded-xl border-2 bg-white/95 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 border-border/50 focus:border-gold disabled:opacity-60"
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Amount */}
      <div>
        <label className="text-xs sm:text-sm font-semibold text-white">Amount (TZS)</label>
        <div className="relative mt-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">TZS</span>
          <input
            type="text"
            value={amount ? formatCurrency(parseInt(amount, 10) || 0) : ""}
            onChange={handleAmountChange}
            placeholder="500"
            disabled={paymentState !== "form"}
            className="w-full h-10 sm:h-11 pl-12 pr-3 rounded-xl border-2 bg-white/95 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 border-border/50 focus:border-gold disabled:opacity-60"
            inputMode="numeric"
          />
        </div>
        <p className="text-xs text-white/50 mt-1">Min TZS 500 — Max 3,000,000</p>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={paymentState !== "form"}
        className={cn(
          "w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all",
          paymentState !== "form"
            ? "bg-white/20 text-white/50 cursor-not-allowed"
            : "gradient-gold text-primary-foreground shadow-lg"
        )}
      >
        {paymentState === "sending" ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </>
        ) : paymentType === "bank" ? (
          "Pay Now"
        ) : (
          "Contribute Now"
        )}
      </button>
    </div>
  );
};

export default PaymentForm;
