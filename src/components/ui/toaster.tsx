import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

const VARIANT_ICONS = {
  default: { Icon: Info, className: "text-primary" },
  success: { Icon: CheckCircle2, className: "text-emerald-500" },
  destructive: { Icon: XCircle, className: "text-red-500" },
  warning: { Icon: AlertTriangle, className: "text-amber-500" },
} as const;

type VariantKey = keyof typeof VARIANT_ICONS;

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider duration={2000}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const variantKey = ((props.variant ?? "default") as VariantKey);
        const { Icon, className } = VARIANT_ICONS[variantKey] ?? VARIANT_ICONS.default;

        return (
          <Toast key={id} {...props}>
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${className}`} />
              <div className="flex flex-col flex-1 min-w-0">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
