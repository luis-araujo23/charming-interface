import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReactNode } from "react";

interface AuthFieldProps {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  icon?: ReactNode;
}

export function AuthField({ id, label, type = "text", placeholder, icon }: AuthFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </span>
        )}
        <Input
          id={id}
          type={type}
          placeholder={placeholder}
          className={`h-11 rounded-xl border-border bg-cream/60 text-base ${icon ? "pl-10" : ""}`}
        />
      </div>
    </div>
  );
}
