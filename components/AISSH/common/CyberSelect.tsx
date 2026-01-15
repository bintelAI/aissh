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

  const baseColor = variant === 'cyan' ? 'text-sci-cyan' : 'text-sci-violet';
  const borderColor = variant === 'cyan' ? 'border-sci-cyan/30' : 'border-sci-violet/30';
  const accentBorder = variant === 'cyan' ? 'border-sci-cyan' : 'border-sci-violet';
  const bgAccent = variant === 'cyan' ? 'bg-sci-cyan/10' : 'bg-sci-violet/10';
  const shadowColor = variant === 'cyan' ? 'rgba(0,243,255,0.3)' : 'rgba(188,19,254,0.3)';

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
          relative flex items-center bg-black/80 border border-white/20 px-3 py-1.5 cursor-pointer
          group transition-all duration-300
          ${isOpen ? `${accentBorder} shadow-[0_0_15px_${shadowColor}]` : `hover:border-${variant === 'cyan' ? 'sci-cyan' : 'sci-violet'}/50 hover:shadow-[0_0_15px_${shadowColor}]`}
        `}
      >
        <div className={`absolute inset-0 bg-gradient-to-r ${variant === 'cyan' ? 'from-sci-cyan/10' : 'from-sci-violet/10'} to-transparent rounded opacity-0 group-hover:opacity-100 transition-opacity`}></div>
        
        {label && (
          <span className="text-[10px] text-white/40 uppercase tracking-widest shrink-0 group-hover:text-white/60 transition-colors mr-1.5 font-sci pointer-events-none select-none">
            {label}
          </span>
        )}
        
        <span className={`text-[11px] font-bold uppercase tracking-widest ${baseColor} truncate pr-4 font-sci pointer-events-none select-none`}>
          {selectedOption?.label}
        </span>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="absolute right-2"
        >
          <ChevronDown size={10} className={`${isOpen ? baseColor : 'text-white/40'} group-hover:${baseColor} transition-colors`} />
        </motion.div>

        {/* Scanline Effect when open */}
        {isOpen && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
            <div className="w-full h-full bg-scanline animate-scanline"></div>
          </div>
        )}
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
              absolute z-[100] left-0 right-0 min-w-[160px] bg-sci-obsidian/95 border ${borderColor} shadow-2xl overflow-hidden
              backdrop-blur-xl pointer-events-auto
              ${direction === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}
            `}
          >
            {/* Menu Header decoration */}
            <div className={`h-0.5 w-full bg-gradient-to-r from-transparent via-${variant === 'cyan' ? 'sci-cyan' : 'sci-violet'} to-transparent opacity-50`}></div>
            
            <div className="py-1">
              {options.map((option) => (
                <motion.div
                  key={option.value}
                  whileHover={{ x: 4, backgroundColor: variant === 'cyan' ? 'rgba(0, 243, 255, 0.1)' : 'rgba(188, 19, 254, 0.1)' }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`
                    px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em] cursor-pointer
                    flex items-center justify-between transition-all font-sci select-none
                    ${value === option.value 
                      ? (variant === 'cyan' ? 'bg-sci-cyan/20 text-sci-cyan' : 'bg-sci-violet/20 text-sci-violet')
                      : 'text-white/60 hover:text-white'}
                  `}
                >
                  <span className="pointer-events-none">{option.label}</span>
                  {value === option.value && (
                    <motion.div 
                      layoutId="active-indicator"
                      className={`w-1 h-1 rounded-full ${variant === 'cyan' ? 'bg-sci-cyan' : 'bg-sci-violet'} shadow-[0_0_5px_currentColor]`}
                    />
                  )}
                </motion.div>
              ))}
            </div>

            {/* Corner decorations */}
            <div className={`absolute bottom-0 right-0 w-2 h-2 border-r border-b ${borderColor} opacity-50`}></div>
            <div className={`absolute top-0 left-0 w-2 h-2 border-l border-t ${borderColor} opacity-50`}></div>
            
            {/* Digital pattern decoration */}
            <div className="absolute bottom-1 left-1 opacity-10 pointer-events-none">
              <div className={`w-4 h-0.5 ${variant === 'cyan' ? 'bg-sci-cyan' : 'bg-sci-violet'} mb-0.5`}></div>
              <div className={`w-2 h-0.5 ${variant === 'cyan' ? 'bg-sci-cyan' : 'bg-sci-violet'}`}></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
