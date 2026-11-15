"use client";
import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

/** Mirrors the server rules so people see problems before sending. */
export function passwordProblem(pw: string, name: string): string | null {
  if (pw.length < 8) return "Use at least 8 characters.";
  if (pw.length > 64) return "Keep it under 64 characters.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Mix letters and numbers.";
  if (name.length >= 3 && pw.toLowerCase().includes(name.toLowerCase())) return "Your password shouldn't contain your username.";
  return null;
}

export function strength(pw: string): { score: number; label: string; color: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  if (!pw) return { score: 0, label: "", color: "#cbd5e1" };
  const labels = ["Too short", "Okay", "Good", "Strong", "Great"];
  const colors = ["#f43f5e", "#f97316", "#facc15", "#34d399", "#16a34a"];
  return { score: s, label: labels[s], color: colors[s] };
}

export function PasswordField({
  label,
  value,
  onChange,
  onEnter,
  autoComplete,
  placeholder = "At least 8 characters",
  meter,
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  meter?: boolean;
  id?: string;
}) {
  const auto = useId();
  const fieldId = id ?? auto;
  const [show, setShow] = useState(false);
  const st = strength(value);
  return (
    <div className="mt-3">
      <label htmlFor={fieldId} className="text-sm font-extrabold">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={fieldId}
          type={show ? "text" : "password"}
          value={value}
          maxLength={64}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
          className="w-full rounded-xl border-[3px] border-[var(--ink)] bg-white py-3 pr-14 pl-3 text-lg font-bold text-[var(--ink)] outline-none focus:border-[var(--violet)]"
        />
        <button
          type="button"
          aria-label={show ? "Hide password" : "Show password"}
          onClick={() => setShow((v) => !v)}
          className="absolute top-1/2 right-2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-[var(--ink)] active:scale-90"
        >
          {show ? <EyeOff size={22} strokeWidth={2.6} /> : <Eye size={22} strokeWidth={2.6} />}
        </button>
      </div>
      {meter && value && (
        <div className="mt-1.5 flex items-center gap-2" aria-live="polite">
          <div className="flex flex-1 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="h-1.5 flex-1 rounded-full transition-colors" style={{ background: i < Math.max(st.score, 1) ? st.color : "#e2e8f0" }} />
            ))}
          </div>
          <span className="w-16 text-right text-xs font-extrabold" style={{ color: st.color }}>
            {st.label}
          </span>
        </div>
      )}
    </div>
  );
}
