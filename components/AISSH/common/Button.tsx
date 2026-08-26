
import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'error' | 'success' | 'sci-cyan' | 'sci-violet';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  glow?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  loading = false,
  glow = false,
  className = '',
  ...props 
}) => {
  const sizeMap = {
    xs: 'px-2 py-1 text-[10px]',
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2 text-xs',
    lg: 'px-8 py-3 text-sm'
  };

  const variantMap = {
    primary: 'bg-sci-cyan border-sci-cyan text-black hover:bg-[#66f6ff] hover:border-[#66f6ff] hover:shadow-neon-cyan',
    secondary: 'bg-sci-obsidian border-white/15 text-sci-text hover:bg-white/5 hover:border-white/20',
    accent: 'bg-sci-green border-sci-green text-black hover:bg-[#4dff4d] hover:border-[#4dff4d] hover:shadow-neon-green',
    ghost: 'bg-transparent border-transparent text-sci-dim hover:bg-white/5 hover:text-sci-text',
    error: 'bg-sci-red border-sci-red text-black hover:bg-[#ff5a3c] hover:border-[#ff5a3c] hover:shadow-neon-red',
    success: 'bg-sci-green border-sci-green text-black hover:bg-[#4dff4d] hover:border-[#4dff4d] hover:shadow-neon-green',
    'sci-cyan': 'bg-sci-cyan border-sci-cyan text-black hover:bg-[#66f6ff] hover:border-[#66f6ff] hover:shadow-neon-cyan',
    'sci-violet': 'bg-sci-violet/10 border-sci-violet/50 text-sci-violet hover:bg-sci-violet hover:text-black hover:shadow-neon-violet',
  };

  return (
    <button 
      className={`
        relative inline-flex items-center justify-center gap-2 rounded-md border font-medium
        transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sci-cyan/70 focus-visible:ring-offset-2 focus-visible:ring-offset-sci-base disabled:pointer-events-none disabled:opacity-50
        ${sizeMap[size]} 
        ${variantMap[variant as keyof typeof variantMap] || variantMap.primary}
        ${glow ? 'shadow-[0_8px_20px_rgba(0,243,255,0.16)]' : ''}
        ${className}
      `}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      <span>{children}</span>
    </button>
  );
};
