import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  isLoading?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  trend,
  isLoading = false
}) => {
  return (
    <div className="bg-card text-card-foreground rounded-xl border border-border/50 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {isLoading ? (
            <div className="h-8 w-24 bg-muted animate-pulse rounded mt-2" />
          ) : (
            <h3 className="text-2xl font-bold mt-1 text-foreground">{value}</h3>
          )}
        </div>
        <div className="p-2.5 bg-primary/10 rounded-lg text-primary">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      
      {(description || trend) && !isLoading && (
        <div className="mt-4 flex items-center text-sm">
          {trend && (
            <span className={`font-medium flex items-center mr-2 ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
          )}
          {description && (
            <span className="text-muted-foreground">{description}</span>
          )}
        </div>
      )}
    </div>
  );
};
