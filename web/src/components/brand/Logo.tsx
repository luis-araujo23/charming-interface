import { motion } from "framer-motion";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
}

export function Logo({ size = "md", showTagline = false }: LogoProps) {
  const sizes = {
    sm: "text-2xl",
    md: "text-4xl",
    lg: "text-6xl md:text-7xl",
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex items-center gap-2"
      >
        <span className={`font-display font-light italic text-primary ${sizes[size]}`}>
          kitty
        </span>
        <span className="h-2 w-2 rounded-full bg-olive" aria-hidden />
      </motion.div>
      {showTagline && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="font-hand text-lg text-muted-foreground"
        >
          tu diario, tu refugio
        </motion.p>
      )}
    </div>
  );
}
