import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'error' | 'success' | 'warning';
  show: boolean;
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ 
  message, 
  type = 'error', 
  show, 
  onClose, 
  duration = 4000 
}) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  if (!show) return null;

  const bgColor = {
    error: 'bg-red-900 border-red-700',
    success: 'bg-green-900 border-green-700', 
    warning: 'bg-yellow-900 border-yellow-700'
  }[type];

  const textColor = {
    error: 'text-red-200',
    success: 'text-green-200',
    warning: 'text-yellow-200'
  }[type];

  return (
    <div className="fixed top-5 right-5 z-50 animate-fadeIn">
      <div className={`${bgColor} ${textColor} px-6 py-4 rounded-lg border shadow-lg max-w-md`}>
        <div className="flex items-center justify-between">
          <span className="font-medium">{message}</span>
          <button 
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-white focus:outline-none"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toast;