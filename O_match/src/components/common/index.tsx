import React from 'react';
import { cn } from '@/utils';
export { QuestionnaireSaveStatus } from './QuestionnaireSaveStatus';
export { QuestionnaireTopProgress } from './QuestionnaireTopProgress';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className, onClick }) => {
  return (
    <div
      className={cn(
        'glass-card rounded-[2rem] p-8 md:p-12',
        'shadow-[0_8px_32px_rgba(28,28,24,0.06),0_0_0_1px_rgba(219,194,178,0.2)]',
        'flex flex-col items-center text-center',
        onClick && 'cursor-pointer hover:scale-[1.02] transition-transform',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ children, className }) => {
  return (
    <div
      className={cn(
        'glass-panel py-3 px-6 rounded-3xl',
        'flex justify-between items-center',
        'backdrop-blur-3xl border-orange-100/30',
        className
      )}
    >
      {children}
    </div>
  );
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  className,
  ...props
}) => {
  const variants = {
    primary: 'sunset-gradient text-white',
    secondary: 'bg-surface-container-low text-on-surface',
    outline: 'border-2 border-primary text-primary',
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <button
      className={cn(
        'rounded-full font-bold transition-all active:scale-95',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  filled?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({ icon, filled, className, ...props }) => {
  return (
    <button
      className={cn(
        'p-2 hover:bg-orange-50/50 dark:hover:bg-stone-800/50 rounded-lg',
        'transition-all active:scale-95',
        className
      )}
      {...props}
    >
      <span
        className="material-symbols-outlined text-2xl"
        style={filled ? { fontVariationSettings: "'FILL' 1" } : {}}
      >
        {icon}
      </span>
    </button>
  );
};

interface ProgressBarProps {
  progress: number;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, className }) => {
  return (
    <div className={cn('h-2 w-full bg-surface-container-high rounded-full overflow-hidden', className)}>
      <div
        className="h-full bg-primary-container rounded-full shadow-[0_0_8px_rgba(246,138,47,0.4)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

export default { GlassCard, GlassPanel, Button, IconButton, ProgressBar };