import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, LockKeyhole, Mail, Moon, ShieldCheck, Sun } from "lucide-react";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";
import Button from "../ui/button/Button";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const success = await login(username, password, isChecked);
    if (success) {
      navigate("/", { replace: true });
    } else {
      setError("Invalid username or password. Please try again.");
    }

    setLoading(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-[400px] flex-col">
      <div className="flex justify-end">
        <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => {
              if (theme === "dark") toggleTheme();
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
              theme === "light"
                ? "bg-blue-50 text-blue-600 shadow-sm dark:bg-blue-500/10 dark:text-blue-300"
                : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            }`}
          >
            <Sun className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (theme === "light") toggleTheme();
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
              theme === "dark"
                ? "bg-slate-950 text-white shadow-sm dark:bg-slate-800"
                : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            }`}
          >
            <Moon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-8 rounded-[24px] border border-slate-200/80 bg-white px-6 py-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 sm:px-7">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700 dark:border-blue-500/10 dark:bg-blue-500/10 dark:text-blue-300">
            <ShieldCheck className="h-4 w-4" />
            Secure Sign In
          </div>
          <h1 className="mt-5 text-[22px] font-semibold tracking-tight text-slate-950 dark:text-slate-50 sm:text-[24px]">
            Welcome back!
          </h1>
          <p className="mt-1.5 text-sm leading-5 text-slate-500 dark:text-slate-400">
            Sign in to access the Transformer Monitoring System.
          </p>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5">
          <div className="space-y-4">
            <div>
              <Label>
                Email <span className="text-error-500">*</span>
              </Label>
              <div className="relative mt-2">
                <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                  <Mail className="h-4.5 w-4.5" />
                </span>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your email"
                  className="h-11 rounded-xl border-slate-200 bg-white px-11 dark:border-slate-700 dark:bg-slate-950/80"
                />
              </div>
            </div>
            <div>
              <Label>
                Password <span className="text-error-500">*</span>
              </Label>
              <div className="relative mt-2">
                <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                  <LockKeyhole className="h-4.5 w-4.5" />
                </span>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="h-11 rounded-xl border-slate-200 bg-white px-11 pr-12 dark:border-slate-700 dark:bg-slate-950/80"
                />
                <span
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 z-30 -translate-y-1/2 cursor-pointer"
                >
                  {showPassword ? (
                    <EyeIcon className="size-5 fill-slate-400 dark:fill-slate-500" />
                  ) : (
                    <EyeCloseIcon className="size-5 fill-slate-400 dark:fill-slate-500" />
                  )}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Checkbox checked={isChecked} onChange={setIsChecked} />
                <span className="block text-sm font-normal text-slate-600 dark:text-slate-400">
                  Remember me
                </span>
              </div>
              <Link
                to="/reset-password"
                className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300"
              >
                Forgot password?
              </Link>
            </div>
            <div>
              <Button
                className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold shadow-[0_14px_28px_rgba(37,99,235,0.24)] hover:bg-blue-700"
                size="sm"
                type="submit"
                disabled={loading}
                endIcon={!loading ? <ArrowRight className="h-4 w-4" /> : undefined}
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </div>
          </div>
        </form>

        <div className="mt-6 flex items-center justify-between border-t border-slate-200/80 pt-4 dark:border-slate-800">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            © 2024 Powertel Communications. All rights reserved.
          </p>
          <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
            Powered by Powertel / ZESA
          </p>
        </div>
      </div>
    </div>
  );
}
