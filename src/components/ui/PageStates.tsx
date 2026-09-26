import { Button } from './Button';

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-stone-200 rounded-xl w-1/3" />
      <div className="h-4 bg-stone-100 rounded-xl w-1/2" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-stone-100 rounded-2xl" />
        ))}
      </div>
      <div className="space-y-3 mt-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-stone-100 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function PageError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-danger-50 flex items-center justify-center text-2xl">⚠️</div>
      <p className="text-navy-800 font-medium">{message ?? 'Something went wrong'}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
      )}
    </div>
  );
}
