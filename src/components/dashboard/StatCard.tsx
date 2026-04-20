import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  iconBg?: string;
  iconText?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  iconBg = "bg-primary/10",
  iconText = "text-primary",
}: StatCardProps) {
  return (
    <Card className="border border-border/70 shadow-sm h-full">
      <CardContent className="flex items-center gap-3 px-5 py-4">
        {/* Icon */}
        <div className={`p-1.5 rounded-lg flex-none ${iconBg}`}>
          <Icon className={`h-3.5 w-3.5 ${iconText}`} />
        </div>

        {/* Value + Label */}
        <div className="flex-1 min-w-0">
          <p className="text-xl font-bold text-foreground leading-none">{value}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">
            {title}
          </p>
        </div>

        {/* Trend — right side */}
        {trend && (
          <p
            className={`text-[11px] font-semibold flex-none ${
              trend.positive ? "text-emerald-600" : "text-destructive"
            }`}
          >
            {trend.positive ? "↑" : "↓"} {trend.value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
