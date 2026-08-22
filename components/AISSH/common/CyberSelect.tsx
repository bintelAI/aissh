import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CyberSelectProps {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  variant?: 'cyan' | 'violet';
  label?: string;
  className?: string;
  width?: string;
  direction?: 'up' | 'down';
}

export const CyberSelect: React.FC<CyberSelectProps> = ({
  value,
  options,
  onChange,
  variant = 'cyan',
  label,
  className = '',
  width = 'auto',
  direction = 'down'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isCyan = variant === 'cyan';
  const baseColor = isCyan ? 'text-sci-cyan' : 'text-sci-violet';
  const borderColor = isCyan ? 'border-sci-cyan/30' : 'border-sci-violet/30';
  const triggerState = isCyan
    ? 'border-sci-cyan/60 shadow-[0_0_0_3px_rgba(56,189,248,0.12)]'
    : 'border-slate-500 shadow-[0_0_0_3px_rgba(148,163,184,0.1)]';
  const triggerHover = isCyan
    ? 'hover:border-sci-cyan/60 hover:shadow-[0_0_0_3px_rgba(56,189,248,0.08)]'
    : 'hover:border-slate-500 hover:shadow-[0_0_0_3px_rgba(148,163,184,0.08)]';

  return (
    <div 
      ref={containerRef}
      className={`relative select-none ${className} ${isOpen ? 'z-[110]' : 'z-10'}`}
      style={{ width }}
    >
      {/* Trigger */}
      <div 
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`
          relative flex items-center rounded-md bg-sci-panel border border-slate-700/80 px-3 py-1.5 cursor-pointer
          group transition-colors duration-150 ${isOpen ? triggerState : triggerHover}
        `}
      >
        {label && (
          <span className="text-[10px] text-sci-dim shrink-0 group-hover:text-sci-text transition-colors mr-1.5 pointer-events-none select-none">
            {label}
          </span>
        )}
        
        <span className={`text-[11px] font-medium ${baseColor} truncate pr-4 pointer-events-none select-none`}>
          {selectedOption?.label}
        </span>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="absolute right-2"
        >
          <ChevronDown size={12} className={`${isOpen ? baseColor : 'text-sci-dim'} transition-colors`} />
        </motion.div>
      </div>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ 
              opacity: 0, 
              y: direction === 'up' ? 10 : -10, 
              scaleY: 0, 
              filter: 'blur(10px)' 
            }}
            animate={{ 
              opacity: 1, 
              y: direction === 'up' ? -4 : 4, 
              scaleY: 1, 
              filter: 'blur(0px)' 
            }}
            exit={{ 
              opacity: 0, 
              y: direction === 'up' ? 10 : -10, 
              scaleY: 0, 
              filter: 'blur(10px)' 
            }}
            style={{ originY: direction === 'up' ? 1 : 0 }}
            transition={{ 
              duration: 0.25, 
              ease: [0.23, 1, 0.32, 1],
              opacity: { duration: 0.15 }
            }}
            className={`
              absolute z-[100] left-0 right-0 min-w-[160px] rounded-md bg-sci-obsidian border ${borderColor} shadow-xl overflow-hidden
              pointer-events-auto
              ${direction === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}
            `}
          >
            <div className="py-1">
              {options.map((option) => (
                <motion.div
                  key={option.value}
                  whileHover={{ x: 2, backgroundColor: isCyan ? 'rgba(56, 189, 248, 0.1)' : 'rgba(148, 163, 184, 0.1)' }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`
                    px-3 py-2 text-xs font-medium cursor-pointer rounded-sm mx-1
                    flex items-center justify-between transition-colors select-none
                    ${value === option.value 
                      ? (isCyan ? 'bg-sci-cyan/15 text-sci-cyan' : 'bg-slate-600/40 text-sci-text')
                      : 'text-sci-dim hover:text-sci-text'}
                  `}
                >
                  <span className="pointer-events-none">{option.label}</span>
                  {value === option.value && (
                    <motion.div 
                      layoutId="active-indicator"
                      className={`w-1.5 h-1.5 rounded-full ${isCyan ? 'bg-sci-cyan' : 'bg-sci-violet'}`}
                    />
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
