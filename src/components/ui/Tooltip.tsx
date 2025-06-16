import React, { useState, useRef, ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export function Tooltip({ 
  content, 
  children, 
  position = 'top', 
  delay = 500,
  className = '' 
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showDelay, setShowDelay] = useState<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    setShowDelay(timeout);
  };

  const handleMouseLeave = () => {
    if (showDelay) {
      clearTimeout(showDelay);
      setShowDelay(null);
    }
    setIsVisible(false);
  };

  const getPositionClasses = () => {
    const base = 'absolute z-50 px-3 py-2 text-xs font-medium text-white bg-black border border-gray-800 rounded-lg shadow-xl pointer-events-none opacity-0 transition-all duration-200 whitespace-nowrap backdrop-blur-sm';
    
    const positions = {
      top: `${base} bottom-full left-1/2 transform -translate-x-1/2 mb-2`,
      bottom: `${base} top-full left-1/2 transform -translate-x-1/2 mt-2`,
      left: `${base} right-full top-1/2 transform -translate-y-1/2 mr-2`,
      right: `${base} left-full top-1/2 transform -translate-y-1/2 ml-2`
    };

    return `${positions[position]} ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`;
  };

  const getArrowClasses = () => {
    const base = 'absolute w-2 h-2 bg-black border-l border-t border-gray-800 transform rotate-45';
    
    const arrows = {
      top: `${base} top-full left-1/2 -translate-x-1/2 -mt-1`,
      bottom: `${base} bottom-full left-1/2 -translate-x-1/2 -mb-1 rotate-45`,
      left: `${base} left-full top-1/2 -translate-y-1/2 -ml-1 rotate-45`,
      right: `${base} right-full top-1/2 -translate-y-1/2 -mr-1 rotate-45`
    };

    return arrows[position];
  };

  return (
    <div 
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      <div
        ref={tooltipRef}
        className={getPositionClasses()}
        role="tooltip"
        aria-hidden="true"
      >
        {content}
        <div className={getArrowClasses()} />
      </div>
    </div>
  );
} 