import { motion } from "framer-motion";
import { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="paper-card w-full max-w-md rounded-3xl p-8 md:p-10"
    >
      <div className="mb-8 space-y-2 text-center">
        <h2 className="font-display text-3xl text-foreground md:text-4xl">{title}</h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children}
      {footer && (
        <div className="mt-6 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          {footer}
        </div>
      )}
    </motion.div>
  );
}
