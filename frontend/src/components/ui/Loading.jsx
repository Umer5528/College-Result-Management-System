import React from 'react';
import { Loader2 } from 'lucide-react';

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={`animate-spin text-brand-500 ${className}`} />;
}

export function PageLoader({ label = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-500">
      <Spinner className="h-8 w-8" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

export default Spinner;
