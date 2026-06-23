import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import MobileNetworkSelector, { MOBILE_NETWORKS } from "@/components/payments/MobileNetworkSelector";

// Payment type
type PaymentType = "mobile_money" | "bank_transfer";

// Mobile money methods
type MobileMoneyMethod = "mpesa" | "tigopesa" | "airtel" | "halopesa" | null;

// Bank methods
type BankMethod = "crdb" | "nmb" | "nbc" | null;

interface PaymentSummary {
  type: PaymentType;
  method: MobileMoneyMethod | BankMethod;
  phone?: string;
  accountNumber?: string;
  reference?: string;
  amount: number;
}

// Mobile money options (shared with reusable selector)
const mobileMoneyMethods = MOBILE_NETWORKS;

// Bank options
const bankMethods = [
  { id: "crdb", name: "CRDB Bank", accountNumber: "02XXXXXXXXXXXX" },
  { id: "nmb", name: "NMB Bank", accountNumber: "XXXXXXXXXX" },
  { id: "nbc", name: "NBC Bank", accountNumber: "XXXXXXXXXXXX" },
];

// Validation functions
const validatePhoneNumber = (phone: string): boolean => {
  const tanzanianPhoneRegex = /^255[0-9]{9}$/;
  return tanzanianPhoneRegex.test(phone.replace(/\s/g, ""));
};

const validateAmount = (amount: number): boolean => {
  return amount > 0 && amount <= 10000000;
};

const formatPhoneNumber = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 12);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
};

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString("en-TZ");
};

// Success Message Component
const PaymentSuccess = ({ summary, onReset }: { summary: PaymentSummary; onReset: () => void }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="text-center py-6"
  >
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
      className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30"
    >
      <CheckCircle2 className="w-10 h-10 text-white" />
    </motion.div>
    <h2 className="text-2xl font-display text-white mb-2">
      {summary.type === "mobile_money" ? "Contribution Initiated!" : "Bank Transfer Details!"}
    </h2>
    <p className="text-sm text-white/70 mb-6">
      {summary.type === "mobile_money" 
        ? "A payment request has been sent to your phone. Please confirm on your device to complete the transaction."
        : "Please use the bank details below to make your transfer. Reference is required for tracking."
      }
    </p>
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-6 text-left border border-white/10">
      <div className="flex justify-between py-2 border-b border-white/10">
        <span className="text-white/60">Type</span>
        <span className="font-semibold text-gold-light">
          {summary.type === "mobile_money" ? "Mobile Money" : "Bank Transfer"}
        </span>
      </div>
      <div className="flex justify-between py-2 border-b border-white/10">
        <span className="text-white/60">
          {summary.type === "mobile_money" ? "Provider" : "Bank"}
        </span>
        <span className="font-semibold text-white">
          {summary.type === "mobile_money" 
            ? mobileMoneyMethods.find(p => p.id === summary.method)?.name
            : bankMethods.find(b => b.id === summary.method)?.name
          }
        </span>
      </div>
      {summary.type === "mobile_money" && summary.phone && (
        <div className="flex justify-between py-2 border-b border-white/10">
          <span className="text-white/60">Phone</span>
          <span className="font-semibold text-white">{formatPhoneNumber(summary.phone)}</span>
        </div>
      )}
      {summary.type === "bank_transfer" && summary.accountNumber && (
        <div className="flex justify-between py-2 border-b border-white/10">
          <span className="text-white/60">Account Number</span>
          <span className="font-semibold text-white">{summary.accountNumber}</span>
        </div>
      )}
      {summary.reference && (
        <div className="flex justify-between py-2 border-b border-white/10">
          <span className="text-white/60">Reference</span>
          <span className="font-semibold text-white">{summary.reference}</span>
        </div>
      )}
      <div className="flex justify-between py-2">
        <span className="text-white/60">Amount</span>
        <span className="font-semibold text-gold-light text-lg">
          TZS {formatCurrency(summary.amount)}
        </span>
      </div>
    </div>
    <motion.button
      onClick={onReset}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="w-full py-3 px-6 rounded-xl gradient-gold text-primary-foreground font-semibold transition-all shadow-lg"
    >
      Make Another Contribution
    </motion.button>
  </motion.div>
);

// Failed Message Component
const PaymentFailed = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="text-center py-6"
  >
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
      className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30"
    >
      <XCircle className="w-10 h-10 text-white" />
    </motion.div>
    <h2 className="text-2xl font-display text-white mb-2">Contribution Failed</h2>
    <p className="text-sm text-white/70 mb-6">{error}</p>
    <motion.button
      onClick={onRetry}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="w-full py-3 px-6 rounded-xl gradient-gold text-primary-foreground font-semibold transition-all shadow-lg"
    >
      Try Again
    </motion.button>
  </motion.div>
);

// Payment Form Component
const PaymentForm = ({ 
  onSuccess, 
  onError 
}: { 
  onSuccess: (summary: PaymentSummary) => void; 
  onError: (error: string) => void;
}) => {
  const [paymentType, setPaymentType] = useState<PaymentType>("mobile_money");
  
  // Mobile money state
  const [phone, setPhone] = useState("");
  const [selectedMobileMethod, setSelectedMobileMethod] = useState<MobileMoneyMethod>(null);
  
  // Bank transfer state
  const [selectedBank, setSelectedBank] = useState<BankMethod>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [reference, setReference] = useState("");
  
  // Common state
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
    setErrors(prev => ({ ...prev, phone: "" }));
  }, []);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    setAmount(value);
    setErrors(prev => ({ ...prev, amount: "" }));
  }, []);

  const handleAccountNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAccountNumber(e.target.value);
    setErrors(prev => ({ ...prev, accountNumber: "" }));
  }, []);

  const handleReferenceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setReference(e.target.value);
    setErrors(prev => ({ ...prev, reference: "" }));
  }, []);

  const handleMobileMethodSelect = useCallback((methodId: string) => {
    setSelectedMobileMethod(methodId as MobileMoneyMethod);
    setErrors(prev => ({ ...prev, method: "" }));
  }, []);

  const handleBankSelect = useCallback((bankId: string) => {
    setSelectedBank(bankId as BankMethod);
    setErrors(prev => ({ ...prev, bank: "" }));
  }, []);

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    const numericAmount = parseInt(amount, 10);

    // Validate amount
    if (!amount) {
      newErrors.amount = "Amount is required";
    } else if (!validateAmount(numericAmount)) {
      newErrors.amount = "Enter a valid amount (1 - 10,000,000 TZS)";
    }

    if (paymentType === "mobile_money") {
      // Validate phone
      const cleanPhone = phone.replace(/\s/g, "");
      if (!cleanPhone) {
        newErrors.phone = "Phone number is required";
      } else if (!validatePhoneNumber(cleanPhone)) {
        newErrors.phone = "Enter a valid Tanzanian number (2557XXXXXXXX)";
      }
      
      // Validate mobile method
      if (!selectedMobileMethod) {
        newErrors.method = "Please select a mobile money provider";
      }
    } else {
      // Validate bank
      if (!selectedBank) {
        newErrors.bank = "Please select a bank";
      }
      
      // Validate account number
      if (!accountNumber.trim()) {
        newErrors.accountNumber = "Account number is required";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Process payment
    setIsProcessing(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    const success = Math.random() > 0.3;
    
    setIsProcessing(false);
    
    if (success) {
      onSuccess({
        type: paymentType,
        method: paymentType === "mobile_money" ? selectedMobileMethod : selectedBank,
        phone: paymentType === "mobile_money" ? phone.replace(/\s/g, "") : undefined,
        accountNumber: paymentType === "bank_transfer" ? accountNumber : undefined,
        reference: reference,
        amount: numericAmount,
      });
    } else {
      onError("Unable to process payment. Please try again or contact your service provider.");
    }
  };

  const numericAmount = parseInt(amount, 10) || 0;
  const isFormValid = numericAmount > 0 && (
    paymentType === "mobile_money" 
      ? phone.replace(/\s/g, "").length === 12 && selectedMobileMethod
      : selectedBank && accountNumber.trim()
  );

  return (
    <div className="space-y-5">
      {/* Payment Type Tabs */}
      <div className="flex rounded-xl bg-white/10 p-1 border border-white/10">
        <button
          type="button"
          onClick={() => { setPaymentType("mobile_money"); setErrors({}); }}
          className={cn(
            "flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200",
            paymentType === "mobile_money"
              ? "bg-white text-primary shadow-md"
              : "text-white/70 hover:text-white hover:bg-white/5"
          )}
        >
          Mobile Money
        </button>
        <button
          type="button"
          onClick={() => { setPaymentType("bank_transfer"); setErrors({}); }}
          className={cn(
            "flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200",
            paymentType === "bank_transfer"
              ? "bg-white text-primary shadow-md"
              : "text-white/70 hover:text-white hover:bg-white/5"
          )}
        >
          Bank Transfer
        </button>
      </div>

      {/* Mobile Money Fields */}
      {paymentType === "mobile_money" && (
        <div className="space-y-4">
          {/* Phone Number Input */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-white">
              Phone Number
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="2557XXXXXXXX"
                className={cn(
                  "w-full h-12 pl-4 pr-4 rounded-xl border-2 bg-white/95 text-base font-medium transition-all duration-200",
                  "focus:outline-none focus:ring-2 focus:ring-white/20",
                  errors.phone 
                    ? "border-red-400 focus:border-red-500" 
                    : "border-border/50 focus:border-gold"
                )}
                maxLength={16}
                inputMode="numeric"
              />
            </div>
            {errors.phone && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-300"
              >
                {errors.phone}
              </motion.p>
            )}
            <p className="text-xs text-white/50">
              Enter your Tanzanian mobile number (e.g., 2557XXXXXXXX)
            </p>
          </div>

          {/* Reference Note for Mobile Money */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-white">
              Reference Note <span className="text-white/40 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={reference}
              onChange={handleReferenceChange}
              placeholder="e.g., Tithe, Offering, Resource Mobilization"
              className={cn(
                "w-full h-12 pl-4 pr-4 rounded-xl border-2 bg-white/95 text-base font-medium transition-all duration-200",
                "focus:outline-none focus:ring-2 focus:ring-white/20 border-border/50 focus:border-gold"
              )}
            />
          </div>

          {/* Mobile Money Provider Selection */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-white">Mobile Money Provider</label>
            <div className="grid grid-cols-2 gap-3">
              {mobileMoneyMethods.map((method) => (
                <motion.button
                  key={method.id}
                  type="button"
                  onClick={() => handleMobileMethodSelect(method.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "relative p-3 rounded-xl border-2 transition-all duration-200 text-left",
                    selectedMobileMethod === method.id
                      ? "border-gold bg-gold/10 shadow-lg shadow-gold/20"
                      : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10"
                  )}
                >
                  <span className="font-medium text-white text-sm">{method.name}</span>
                  {selectedMobileMethod === method.id && (
                    <motion.div
                      layoutId="selectedMobileMethod"
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gold flex items-center justify-center"
                    >
                      <CheckCircle2 className="w-3 h-3 text-primary" />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
            {errors.method && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-300"
              >
                {errors.method}
              </motion.p>
            )}
          </div>
        </div>
      )}

      {/* Bank Transfer Fields */}
      {paymentType === "bank_transfer" && (
        <div className="space-y-4">
          {/* Bank Selection */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-white">Select Bank</label>
            <div className="grid grid-cols-1 gap-3">
              {bankMethods.map((bank) => (
                <motion.button
                  key={bank.id}
                  type="button"
                  onClick={() => handleBankSelect(bank.id)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={cn(
                    "relative p-4 rounded-xl border-2 transition-all duration-200 text-left",
                    selectedBank === bank.id
                      ? "border-gold bg-gold/10 shadow-lg shadow-gold/20"
                      : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10"
                  )}
                >
                  <div className="flex-1">
                    <span className="font-semibold text-white block">{bank.name}</span>
                    <span className="text-xs text-white/50">Acc: {bank.accountNumber}</span>
                  </div>
                  {selectedBank === bank.id && (
                    <motion.div
                      layoutId="selectedBank"
                      className="absolute top-3 right-3 w-5 h-5 rounded-full bg-gold flex items-center justify-center"
                    >
                      <CheckCircle2 className="w-3 h-3 text-primary" />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
            {errors.bank && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-300"
              >
                {errors.bank}
              </motion.p>
            )}
          </div>

          {/* Account Number */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-white">
              Account Number
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={handleAccountNumberChange}
              placeholder="Enter your account number"
              className={cn(
                "w-full h-12 pl-4 pr-4 rounded-xl border-2 bg-white/95 text-base font-medium transition-all duration-200",
                "focus:outline-none focus:ring-2 focus:ring-white/20",
                errors.accountNumber 
                  ? "border-red-400 focus:border-red-500" 
                  : "border-border/50 focus:border-gold"
              )}
            />
            {errors.accountNumber && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-300"
              >
                {errors.accountNumber}
              </motion.p>
            )}
          </div>
        </div>
      )}

      {/* Amount Input (Common for both) */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-white">
          Amount (TZS)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base text-muted-foreground font-medium">
            TZS
          </span>
          <input
            type="text"
            value={amount ? formatCurrency(numericAmount) : ""}
            onChange={handleAmountChange}
            placeholder="0"
            className={cn(
              "w-full h-12 pl-16 pr-4 rounded-xl border-2 bg-white/95 text-base font-medium transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-white/20",
              errors.amount 
                ? "border-red-400 focus:border-red-500" 
                : "border-border/50 focus:border-gold"
            )}
            inputMode="numeric"
          />
        </div>
        {errors.amount && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-red-300"
          >
            {errors.amount}
          </motion.p>
        )}
      </div>

      {/* Payment Summary */}
      <AnimatePresence>
        {isFormValid && !isProcessing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10"
          >
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Contribution Summary
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/60">Payment Type</span>
                <span className="font-medium text-white">
                  {paymentType === "mobile_money" ? "Mobile Money" : "Bank Transfer"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">
                  {paymentType === "mobile_money" ? "Provider" : "Bank"}
                </span>
                <span className="font-medium text-white">
                  {paymentType === "mobile_money"
                    ? mobileMoneyMethods.find(p => p.id === selectedMobileMethod)?.name
                    : bankMethods.find(b => b.id === selectedBank)?.name
                  }
                </span>
              </div>
              {paymentType === "mobile_money" ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-white/60">Phone Number</span>
                    <span className="font-medium text-white">{formatPhoneNumber(phone)}</span>
                  </div>
                  {reference && (
                    <div className="flex justify-between">
                      <span className="text-white/60">Reference</span>
                      <span className="font-medium text-white">{reference}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-white/60">Account Number</span>
                  <span className="font-medium text-white">{accountNumber}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-white/10">
                <span className="text-white font-semibold">Total Amount</span>
                <span className="text-gold-light font-bold text-lg">
                  TZS {formatCurrency(numericAmount)}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contribute Now Button */}
      <motion.button
        type="button"
        onClick={handleSubmit}
        disabled={isProcessing}
        whileHover={!isProcessing ? { scale: 1.01 } : {}}
        whileTap={!isProcessing ? { scale: 0.99 } : {}}
        className={cn(
          "w-full h-12 rounded-xl font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2",
          isProcessing
            ? "bg-white/20 text-white/50 cursor-not-allowed"
            : isFormValid
              ? "gradient-gold text-primary-foreground shadow-lg shadow-gold/25 hover:shadow-xl"
              : "bg-white/20 text-white/50 cursor-not-allowed"
        )}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing...
          </>
        ) : (
          "Contribute Now"
        )}
      </motion.button>

      {/* Footer */}
      <p className="text-center text-xs text-white/40">
        @Chuo Kikuu SDA
      </p>
    </div>
  );
};

// Main GuestDashboard Component
const GuestDashboard = () => {
  const [paymentState, setPaymentState] = useState<"form" | "success" | "error">("form");
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [error, setError] = useState("");

  const handleSuccess = useCallback((paymentSummary: PaymentSummary) => {
    setSummary(paymentSummary);
    setPaymentState("success");
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setPaymentState("error");
  }, []);

  const handleReset = useCallback(() => {
    setPaymentState("form");
    setSummary(null);
    setError("");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 dark:border-slate-700/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link 
            to="/" 
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </Link>
          <h1 className="text-lg font-bold text-foreground">Make Contribution</h1>
          <div className="w-16" />
        </div>
      </header>

      {/* Main Content - Matching Auth Page Style */}
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-8">
        <motion.div
          className="relative w-[90vw] sm:w-full max-w-md p-8 rounded-3xl text-center overflow-hidden"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
          style={{
            backgroundImage: 'url(/sda_clean_super.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-church-blue/95 via-church-blue/90 to-church-blue-dark/95" />
          
          {/* Content */}
          <div className="relative z-10">
            {/* Header */}
            <motion.div
              className="w-14 h-14 rounded-2xl bg-white/95 flex items-center justify-center mx-auto mb-5 shadow-lg overflow-hidden"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            >
              <img src="/sda_clean_super.png" alt="SDA Logo" className="w-9 h-9 object-contain" />
            </motion.div>

            <h1 className="text-2xl font-display text-white mb-1">
              Chuo Kikuu SDA Church
            </h1>
            <p className="text-xs font-semibold text-gold-light mb-4">Support Our Mission</p>

            {/* Form or Status */}
            <AnimatePresence mode="wait">
              {paymentState === "form" && (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <PaymentForm onSuccess={handleSuccess} onError={handleError} />
                </motion.div>
              )}
              {paymentState === "success" && summary && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <PaymentSuccess summary={summary} onReset={handleReset} />
                </motion.div>
              )}
              {paymentState === "error" && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <PaymentFailed error={error} onRetry={handleReset} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default GuestDashboard;

