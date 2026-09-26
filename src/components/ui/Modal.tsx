import { type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className = '' }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-elevated border border-stone-200 w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in ${className}`}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
            <h2 className="font-serif text-lg font-semibold text-navy-800">{title}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
