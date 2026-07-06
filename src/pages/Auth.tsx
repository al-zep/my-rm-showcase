import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { signIn, sendOtp, verifyOtp, normalizePhone } from "@/lib/auth";
import { Phone, Shield, User, Loader2 } from "lucide-react";

type SignupStep = "phone" | "otp";

const Auth = () => {
  const [signupStep, setSignupStep] = useState<SignupStep>("phone");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSignIn = async () => {
    setErrorMsg(null);
    if (!phone.trim()) {
      setErrorMsg("Tafadhali ingiza namba ya simu");
      return;
    }

    setLoading(true);
    try {
      await signIn(phone);
      navigate("/dashboard");
    } catch (err: any) {
      setErrorMsg(err?.message || "Imeshindwa kuingia");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setErrorMsg(null);
    if (!phone.trim()) {
      setErrorMsg("Tafadhali ingiza namba ya simu");
      return;
    }
    if (!fullName.trim()) {
      setErrorMsg("Tafadhali ingiza jina lako kamili");
      return;
    }

    setLoading(true);
    try {
      await sendOtp(phone, fullName);
      setSignupStep("otp");
    } catch (err: any) {
      setErrorMsg(err?.message || "Imeshindwa kutuma OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setErrorMsg(null);
    if (!otp.trim() || otp.length !== 6) {
      setErrorMsg("Tafadhali ingiza OTP yenye tarakimu 6");
      return;
    }

    setLoading(true);
    try {
      await verifyOtp(phone, otp, fullName);
      navigate("/dashboard");
    } catch (err: any) {
      setErrorMsg(err?.message || "OTP si sahihi au imekwisha muda");
    } finally {
      setLoading(false);
    }
  };

  const resetSignup = () => {
    setSignupStep("phone");
    setOtp("");
    setErrorMsg(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">Karibu</CardTitle>
          <CardDescription className="text-muted-foreground">
            {mode === "signin"
              ? "Ingiza namba yako ya simu kuingia"
              : signupStep === "phone"
              ? "Jisajili kwa namba yako ya simu"
              : "Ingiza OTP uliyotumwa kwenye simu yako"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs
            value={mode}
            onValueChange={(v) => {
              setMode(v as "signin" | "signup");
              resetSignup();
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Ingia</TabsTrigger>
              <TabsTrigger value="signup">Jisajili</TabsTrigger>
            </TabsList>

            {errorMsg && (
              <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive text-center">
                {errorMsg}
              </div>
            )}

            {/* SIGN IN - Phone only */}
            <TabsContent value="signin" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Namba ya Simu</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="0712345678 au 255712345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
              </div>
              <Button onClick={handleSignIn} className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Ingia
              </Button>
            </TabsContent>

            {/* SIGN UP - Phone + OTP */}
            <TabsContent value="signup" className="space-y-4">
              {signupStep === "phone" ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Jina Kamili</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Jina lako kamili"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-10"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Namba ya Simu</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="tel"
                        placeholder="0712345678 au 255712345678"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <Button onClick={handleSendOtp} className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Tuma OTP
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Namba ya OTP</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Ingiza OTP yenye tarakimu 6"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="text-center text-2xl tracking-[0.5em] font-mono"
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      OTP imetumwa kwa {normalizePhone(phone)}
                    </p>
                  </div>
                  <Button onClick={handleVerifyOtp} className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Thibitisha OTP
                  </Button>
                  <Button variant="ghost" onClick={resetSignup} className="w-full" disabled={loading}>
                    Rudi nyuma
                  </Button>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
