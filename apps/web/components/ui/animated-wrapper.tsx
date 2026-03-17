"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { fadeInUp, scaleIn, staggerContainer, staggerItem } from "@/lib/utils/animations";

interface AnimatedWrapperProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  animation?: "fadeInUp" | "scaleIn" | "stagger";
  delay?: number;
  className?: string;
}

const animations = {
  fadeInUp,
  scaleIn,
  stagger: staggerContainer,
};

export function AnimatedWrapper({
  children,
  animation = "fadeInUp",
  delay = 0,
  className,
  ...props
}: AnimatedWrapperProps) {
  const variants = animations[animation];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={variants}
      transition={{ delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface AnimatedListItemProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
}

export function AnimatedListItem({ children, className, ...props }: AnimatedListItemProps) {
  return (
    <motion.div variants={staggerItem} className={className} {...props}>
      {children}
    </motion.div>
  );
}

interface AnimatedButtonProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
  className?: string;
}

export function AnimatedButton({ children, className, ...props }: AnimatedButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={className}
      {...props}
    >
      {children}
    </motion.button>
  );
}
