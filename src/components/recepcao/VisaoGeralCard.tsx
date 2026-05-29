import React from 'react';
import { LucideIcon } from 'lucide-react';

interface VisaoGeralCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtext: string;
  subtextColorClass?: string; // e.g. text-blue-400, text-emerald-400, text-purple-400
  isLoading?: boolean;
}

export const VisaoGeralCard: React.FC<VisaoGeralCardProps> = ({
  title,
  value,
  icon: Icon,
  subtext,
  subtextColorClass = 'text-slate-400',
  isLoading = false,
}) => {
  return (
    <div className="relative overflow-hidden bg-white dark:bg-[#121625] border border-slate-200/80 dark:border-white/5 rounded-2xl p-5 flex flex-col justify-between min-h-[135px] hover:border-slate-300 dark:hover:border-white/10 hover:shadow-md hover:shadow-slate-200/50 dark:hover:shadow-black/20 transition-all duration-300 group">
      {/* Background Watermark Icon */}
      <div className="absolute right-3 bottom-2 text-slate-100 dark:text-white/5 group-hover:text-slate-200/70 dark:group-hover:text-white/10 group-hover:scale-110 transition-all duration-500 pointer-events-none">
        <Icon className="w-16 h-16 stroke-[1.2]" />
      </div>

      <div className="flex flex-col">
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {title}
        </span>
        
        {isLoading ? (
          <div className="h-9 w-20 bg-slate-100 dark:bg-white/5 animate-pulse rounded-lg mt-3" />
        ) : (
          <span className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2 tracking-tight">
            {value}
          </span>
        )}
      </div>

      {!isLoading && (
        <div className={`mt-4 flex items-center text-xs font-semibold tracking-wide ${subtextColorClass}`}>
          {subtext}
        </div>
      )}
    </div>
  );
};
