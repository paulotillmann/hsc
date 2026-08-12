import React from 'react';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="w-full space-y-6 animate-pulse p-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-28 bg-muted rounded-2xl p-4 border border-border space-y-3">
            <div className="h-4 bg-muted-foreground/20 rounded-md w-1/2"></div>
            <div className="h-8 bg-muted-foreground/20 rounded-md w-3/4"></div>
            <div className="h-3 bg-muted-foreground/10 rounded-md w-2/3"></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 h-72 bg-muted rounded-2xl border border-border p-6 space-y-4">
          <div className="h-5 bg-muted-foreground/20 rounded-md w-1/3"></div>
          <div className="h-48 bg-muted-foreground/10 rounded-xl w-full"></div>
        </div>

        <div className="md:col-span-1 h-72 bg-muted rounded-2xl border border-border p-6 space-y-4">
          <div className="h-5 bg-muted-foreground/20 rounded-md w-1/2"></div>
          <div className="h-48 bg-muted-foreground/10 rounded-full w-48 h-48 mx-auto"></div>
        </div>
      </div>

      <div className="h-64 bg-muted rounded-2xl border border-border p-6 space-y-4">
        <div className="h-5 bg-muted-foreground/20 rounded-md w-1/4"></div>
        <div className="h-40 bg-muted-foreground/10 rounded-xl w-full"></div>
      </div>
    </div>
  );
};
