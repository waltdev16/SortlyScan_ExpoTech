"use client";
import { motion, useReducedMotion } from "motion/react";
export function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  // El contenido siempre es visible incluso antes de hidratar o si JavaScript falla.
  return (
    <motion.div
      className={className}
      initial={false}
      whileInView={reduce ? undefined : { y: [14, 0] }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
