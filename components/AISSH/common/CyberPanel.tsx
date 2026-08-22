import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface CyberPanelProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  brackets?: boolean;
  variant?: 'base' | 'panel' | 'obsidian';
  noAnimation?: boolean;
}

export const CyberPanel: React.FC<CyberPanelProps> = ({
  children,
  className = '',
  glow = false,
  brackets = true,
  variant = 'panel',
  noAnimation = false,
  ...props
}) => {
  const bgMap = {
    base: 'bg-sci-base/95',
    panel: 'bg-sci-panel/95',
    obsidian: 'bg-sci-obsidian/95'
  };

  const Component = noAnimation ? 'div' : motion.div;

  return (
    // @ts-ignore - Dynamic component type issue with framer-motion
    <Component
      className={`
        relative ${bgMap[variant]} rounded-md border border-slate-700/60 shadow-[0_8px_24px_rgba(0,0,0,0.18)]
        ${glow ? 'border-sci-cyan/40 shadow-neon-cyan' : ''}
        ${className}
      `}
      initial={!noAnimation ? { opacity: 0, y: 10 } : undefined}
      animate={!noAnimation ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.3 }}
      {...props}
    >
      {brackets && (
        <>
          <span className="pointer-events-none absolute left-0 top-0 h-3 w-3 border-l border-t border-sci-cyan/50" />
          <span className="pointer-events-none absolute right-0 top-0 h-3 w-3 border-r border-t border-sci-cyan/50" />
          <span className="pointer-events-none absolute bottom-0 left-0 h-3 w-3 border-b border-l border-sci-cyan/50" />
          <span className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b border-r border-sci-cyan/50" />
        </>
      )}
      {children}
    </Component>
  );
};
