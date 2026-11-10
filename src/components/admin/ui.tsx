"use client";

import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Botões                                                              */
/* ------------------------------------------------------------------ */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-600 shadow-sm shadow-brand-900/10 disabled:bg-brand-300",
  secondary: "bg-white text-sand-800 ring-1 ring-sand-300 hover:bg-sand-100 hover:ring-sand-400 disabled:text-sand-400",
  ghost: "text-sand-700 hover:bg-sand-200/70 disabled:text-sand-400",
  danger: "bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:text-red-300",
  dark: "bg-sand-900 text-white hover:bg-sand-800 disabled:bg-sand-500",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    icon: Icon,
    iconRight: IconRight,
    loading,
    className,
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  const sizes = { sm: "h-8 px-3 text-[13px] gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-5 text-[15px] gap-2" };
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed",
        sizes[size],
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : Icon ? <Icon className="size-4" aria-hidden /> : null}
      {children}
      {IconRight ? <IconRight className="size-4" aria-hidden /> : null}
    </button>
  );
});

export function IconButton({
  icon: Icon,
  label,
  className,
  tone = "default",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; tone?: "default" | "danger" | "active" }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cx(
        "inline-flex size-8 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-40",
        tone === "danger"
          ? "text-sand-500 hover:bg-red-50 hover:text-red-700"
          : tone === "active"
            ? "bg-brand-50 text-brand-600"
            : "text-sand-500 hover:bg-sand-200/70 hover:text-sand-900",
        className,
      )}
      {...rest}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Formulários                                                         */
/* ------------------------------------------------------------------ */
const fieldBase =
  "w-full rounded-lg border border-sand-300 bg-white px-3 text-sm text-sand-900 placeholder:text-sand-400 transition focus:border-brand-400 focus:outline-none focus:ring-3 focus:ring-brand-500/15 disabled:bg-sand-100 disabled:text-sand-500";

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
  aside,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  aside?: ReactNode;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {(label || aside) && (
        <div className="flex items-baseline justify-between gap-2">
          {label && (
            <label htmlFor={htmlFor} className="text-[13px] font-medium text-sand-800">
              {label}
            </label>
          )}
          {aside}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-xs text-red-700">{error}</p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-sand-500">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(fieldBase, "h-10", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cx(fieldBase, "py-2 leading-relaxed", className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(fieldBase, "h-10 cursor-pointer pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  suffix?: string;
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  const [prev, setPrev] = useState(value);
  // Sincroniza com o valor externo (padrão de estado derivado do React).
  if (prev !== value) {
    setPrev(value);
    if (Number(text) !== value) setText(value === undefined ? "" : String(value));
  }
  return (
    <div className={cx("relative", className)}>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value === "") return onChange(undefined);
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
        onBlur={() => {
          if (text === "") return;
          let n = Number(text);
          if (typeof min === "number" && n < min) n = min;
          if (typeof max === "number" && n > max) n = max;
          setText(String(n));
          onChange(n);
        }}
        className={cx(fieldBase, "h-10", suffix && "pr-9")}
        {...rest}
      />
      {suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-sand-500">{suffix}</span>}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx("flex cursor-pointer items-start gap-3", disabled && "cursor-not-allowed opacity-60")}>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-5 w-9 rounded-full bg-sand-300 transition peer-checked:bg-brand-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500" />
        <span className="absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
      </span>
      {(label || description) && (
        <span className="flex flex-col">
          {label && <span className="text-sm font-medium text-sand-800">{label}</span>}
          {description && <span className="text-xs leading-relaxed text-sand-500">{description}</span>}
        </span>
      )}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; icon?: LucideIcon }[];
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-lg bg-sand-200/70 p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-md font-medium transition",
            size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
            value === o.value ? "bg-white text-sand-900 shadow-sm" : "text-sand-600 hover:text-sand-900",
          )}
        >
          {o.icon && <o.icon className="size-3.5" aria-hidden />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Estrutura                                                           */
/* ------------------------------------------------------------------ */
export function Card({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx("rounded-xl border border-sand-200 bg-white shadow-[0_1px_2px_rgba(60,30,15,0.04)]", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-sand-200/80 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-sand-900">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] leading-relaxed text-sand-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export type Tone = "neutral" | "brand" | "green" | "amber" | "red" | "blue" | "violet";
const TONES: Record<Tone, string> = {
  neutral: "bg-sand-100 text-sand-700 ring-sand-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function Badge({
  tone = "neutral",
  children,
  icon: Icon,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-3" aria-hidden />}
      {children}
    </span>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[28px] leading-tight font-medium text-sand-900">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-sand-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-sand-300 bg-white/60 px-6 py-14 text-center">
      <span className="mb-3 inline-flex size-11 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="text-[15px] font-semibold text-sand-900">{title}</h3>
      {children && <p className="mt-1 max-w-md text-sm leading-relaxed text-sand-500">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({
  tone = "amber",
  icon: Icon,
  title,
  children,
  action,
}: {
  tone?: "amber" | "red" | "blue" | "green" | "neutral";
  icon?: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
    blue: "border-sky-200 bg-sky-50 text-sky-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    neutral: "border-sand-200 bg-sand-100 text-sand-800",
  };
  return (
    <div className={cx("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", tones[tone])}>
      {Icon && <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <div className="min-w-0 flex-1 leading-relaxed">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Diálogos (elemento <dialog> nativo)                                 */
/* ------------------------------------------------------------------ */
/** Fecha ao clicar fora ou com Esc (atributo HTML closedby; há alternativa em JS abaixo). */
const LIGHT_DISMISS = { closedby: "any" } as Record<string, string>;
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  side = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  side?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const handleClose = () => onCloseRef.current();
    d.addEventListener("close", handleClose);
    // Fechamento ao clicar fora para navegadores sem suporte a closedby.
    const supportsClosedBy = "closedBy" in HTMLDialogElement.prototype;
    const onClick = (event: MouseEvent) => {
      if (supportsClosedBy || event.target !== d) return;
      const r = d.getBoundingClientRect();
      const inside = r.top <= event.clientY && event.clientY <= r.bottom && r.left <= event.clientX && event.clientX <= r.right;
      if (!inside) d.close();
    };
    d.addEventListener("click", onClick);
    return () => {
      d.removeEventListener("close", handleClose);
      d.removeEventListener("click", onClick);
    };
  }, []);

  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl", full: "max-w-[min(1400px,96vw)]" };
  return (
    <dialog
      ref={ref}
      {...LIGHT_DISMISS}
      aria-labelledby={titleId}
      className={cx(
        "overscroll-contain bg-transparent p-0 backdrop:overflow-hidden backdrop:overscroll-contain backdrop:bg-sand-900/45 backdrop:backdrop-blur-[2px]",
        side ? "mr-0 ml-auto h-dvh max-h-dvh w-full max-w-xl" : cx("m-auto w-[calc(100%-2rem)]", widths[size]),
      )}
    >
      {open && (
        <div className={cx("flex flex-col bg-white shadow-2xl", side ? "h-full" : "max-h-[90dvh] rounded-2xl")}>
          <header className="flex items-start justify-between gap-4 border-b border-sand-200 px-6 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-[17px] font-semibold text-sand-900">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-[13px] text-sand-500">{description}</p>}
            </div>
            <IconButton icon={X} label="Fechar" onClick={() => ref.current?.close()} />
          </header>
          <div className="admin-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && (
            <footer className="flex items-center justify-end gap-2 border-t border-sand-200 bg-sand-50/60 px-6 py-3">{footer}</footer>
          )}
        </div>
      )}
    </dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Confirmação e avisos                                                */
/* ------------------------------------------------------------------ */
interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}
interface Toast {
  id: number;
  message: ReactNode;
  tone: "success" | "error" | "info";
}
interface FeedbackCtx {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  toast: (message: ReactNode, tone?: Toast["tone"]) => void;
}
const FeedbackContext = createContext<FeedbackCtx | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ ...o, resolve })), []);
  const toast = useCallback((message: ReactNode, tone: Toast["tone"] = "success") => {
    const id = ++counter.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 9000 : 4500);
  }, []);

  const finish = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  return (
    <FeedbackContext.Provider value={{ confirm, toast }}>
      {children}
      <Modal
        open={!!dialog}
        onClose={() => finish(false)}
        title={dialog?.title ?? ""}
        size="sm"
        footer={
          <>
            <Button onClick={() => finish(false)}>Cancelar</Button>
            <Button variant={dialog?.danger ? "danger" : "primary"} onClick={() => finish(true)}>
              {dialog?.confirmLabel ?? "Confirmar"}
            </Button>
          </>
        }
      >
        <div className="text-sm leading-relaxed text-sand-700">{dialog?.message}</div>
      </Modal>
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg",
              t.tone === "error"
                ? "border-red-200 bg-red-50 text-red-900"
                : t.tone === "info"
                  ? "border-sand-200 bg-white text-sand-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackCtx {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("FeedbackProvider ausente");
  return ctx;
}
