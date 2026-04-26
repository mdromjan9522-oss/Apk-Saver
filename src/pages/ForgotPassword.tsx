import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { db, ALLOWED_EMAIL } from "@/lib/firebase";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Footer } from "@/components/Footer";
import { Loader2, KeyRound, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type Step = "email" | "otp" | "reset";

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const ForgotPassword = () => {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (email.trim().toLowerCase() !== ALLOWED_EMAIL) {
      setError("OTP not sent. This email is not authorized.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("send-otp", {
        body: { email: email.trim().toLowerCase() },
      });
      if (fnError) throw new Error(fnError.message || "Failed to send OTP");
      if (!data?.ok || !data?.hash || !data?.expiresAt) {
        throw new Error(data?.error || "Failed to send OTP");
      }
      // Store hash + expiry in Firestore so verification still works cross-device
      await setDoc(doc(db, "config", "otp"), {
        hash: data.hash,
        expiresAt: data.expiresAt,
        createdAt: Date.now(),
      });
      toast.success(`OTP sent to ${ALLOWED_EMAIL}`);
      setStep("otp");
    } catch (err: any) {
      setError(err?.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (otp.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "config", "otp"));
      if (!snap.exists()) {
        setError("No OTP found. Please request a new one.");
        setLoading(false);
        return;
      }
      const data = snap.data() as { hash: string; expiresAt: number };
      if (Date.now() > data.expiresAt) {
        setError("This OTP has expired. Please request a new one.");
        setLoading(false);
        return;
      }
      const hash = await sha256Hex(otp);
      if (hash !== data.hash) {
        setError("Incorrect OTP. Please try again.");
        setLoading(false);
        return;
      }
      setStep("reset");
    } catch (err: any) {
      setError(err?.message || "Could not verify OTP.");
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await updatePassword(newPassword);
      await deleteDoc(doc(db, "config", "otp")).catch(() => {});
      toast.success("Password updated! Please sign in.");
      navigate("/login", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Could not update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md shadow-elegant border-border/50 animate-fade-in-up">
          <CardHeader className="text-center space-y-3 pb-4">
            <div className="mx-auto w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-elegant">
              <KeyRound className="w-7 h-7 text-primary-foreground" strokeWidth={2.2} />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {step === "email" && "Forgot Password"}
              {step === "otp" && "Enter OTP"}
              {step === "reset" && "Set New Password"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {step === "email" && "We'll send a 6-digit code to your registered email"}
              {step === "otp" && `Check your inbox at ${ALLOWED_EMAIL}`}
              {step === "reset" && "Choose a strong new password"}
            </p>
          </CardHeader>
          <CardContent>
            {step === "email" && (
              <form onSubmit={submitEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}
                <Button type="submit" className="w-full gradient-primary text-primary-foreground hover:opacity-90" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send OTP"}
                </Button>
              </form>
            )}

            {step === "otp" && (
              <form onSubmit={submitOtp} className="space-y-5">
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md text-center">{error}</p>}
                <Button type="submit" className="w-full gradient-primary text-primary-foreground hover:opacity-90" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify OTP"}
                </Button>
                <button type="button" onClick={() => { setStep("email"); setOtp(""); setError(null); }} className="text-sm text-muted-foreground hover:text-foreground w-full text-center">
                  Use a different email
                </button>
              </form>
            )}

            {step === "reset" && (
              <form onSubmit={submitReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newpw">New Password</Label>
                  <Input id="newpw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmpw">Confirm Password</Label>
                  <Input id="confirmpw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </div>
                {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}
                <Button type="submit" className="w-full gradient-primary text-primary-foreground hover:opacity-90" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
                </Button>
              </form>
            )}

            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to login
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default ForgotPassword;
