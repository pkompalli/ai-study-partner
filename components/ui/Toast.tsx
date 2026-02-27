'use client'
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

const icons = {
  success: <CheckCircle className="h-5 w-5 text-green-500" />,
  error: <XCircle className="h-5 w-5 text-red-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
};

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border min-w-[280px] max-w-sm',
            toast.type === 'success' && 'bg-green-50 text-green-800 border-green-200',
            toast.type === 'error' && 'bg-red-50 text-red-800 border-red-200',
            toast.type === 'info' && 'bg-white text-gray-800 border-gray-200'
          )}
        >
          {icons[toast.type]}
          <p className="flex-1 text-sm text-gray-800">{toast.message}</p>
          <button onClick={() => removeToast(toast.id)} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
