import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
  align?: 'left' | 'right';
}

interface DropdownItemProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function Dropdown({ trigger, children, className = '', align = 'left' }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Calculate proper position to prevent cutoff
  useEffect(() => {
    if (isOpen && contentRef.current && dropdownRef.current) {
      const content = contentRef.current;
      const trigger = dropdownRef.current;
      const rect = trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      // Reset position
      content.style.top = '';
      content.style.bottom = '';
      content.style.left = '';
      content.style.right = '';
      
      // Check if dropdown would go off bottom of screen
      const spaceBelow = viewportHeight - rect.bottom;
      const contentHeight = content.offsetHeight;
      
      if (spaceBelow < contentHeight + 10) {
        // Show above trigger
        content.style.bottom = '100%';
        content.style.marginBottom = '4px';
      } else {
        // Show below trigger (default)
        content.style.top = '100%';
        content.style.marginTop = '4px';
      }
      
      // Check horizontal positioning
      if (align === 'right') {
        const spaceRight = viewportWidth - rect.right;
        const contentWidth = content.offsetWidth;
        
        if (spaceRight < contentWidth + 10) {
          // Align to left edge of trigger
          content.style.left = '0';
          content.style.right = 'auto';
        } else {
          // Align to right edge of trigger
          content.style.right = '0';
          content.style.left = 'auto';
        }
      } else {
        const spaceLeft = rect.left;
        const contentWidth = content.offsetWidth;
        
        if (spaceLeft < contentWidth + 10) {
          // Align to right edge of trigger
          content.style.right = '0';
          content.style.left = 'auto';
        } else {
          // Align to left edge of trigger
          content.style.left = '0';
          content.style.right = 'auto';
        }
      }
    }
  }, [isOpen, align]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>
      
      {isOpen && (
        <div 
          ref={contentRef}
          className="absolute z-50 min-w-[200px] py-2 mt-2 bg-[var(--c3-bg-elevated)] border border-[var(--c3-border-primary)] rounded-lg shadow-xl c3-glass-heavy c3-animate-slide-up"
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({ 
  children, 
  onClick, 
  className = '', 
  disabled = false 
}: DropdownItemProps) {
  return (
    <div 
      className={cn(
        "px-4 py-2 text-sm text-[var(--c3-text-primary)] transition-all duration-150",
        "hover:bg-[var(--c3-surface-hover)] hover:pl-5",
        {
          "opacity-50 cursor-not-allowed": disabled,
          "cursor-pointer": !disabled
        },
        className
      )}
      onClick={disabled ? undefined : onClick}
    >
      {children}
    </div>
  );
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-[var(--c3-border-subtle)]" />;
} 