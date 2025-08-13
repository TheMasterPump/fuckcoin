import React, { useEffect, useState } from 'react';

interface SuccessNotificationProps {
  show: boolean;
  onClose: () => void;
  amount: string;
  txHash: string;
  network?: "ethereum" | "base";
  bridgeDirection?: "solana-to-evm" | "evm-to-solana";
}

export default function SuccessNotification({ show, onClose, amount, txHash, network = "base", bridgeDirection = "solana-to-evm" }: SuccessNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      // Auto-close après 8 secondes
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Attendre la fin de l'animation
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
        {/* Modal */}
        <div className={`bg-[#151b25] border border-[#293244] rounded-2xl shadow-2xl max-w-md w-full transform transition-all duration-300 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}>
          <div className="p-6 text-center">
            {/* Icon de succès */}
            <div className="mx-auto flex items-center justify-center h-16 w-16 bg-green-900/20 border border-green-600/30 rounded-full mb-4">
              <svg className="h-8 w-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            {/* Titre */}
            <h3 className="text-2xl font-bold text-white mb-2">
              Fuck you 🖕 Bridge Successful!
            </h3>
            
            {/* Message */}
            <p className="text-gray-300 mb-4">
              You just bridged <span className="font-bold text-purple-400">{amount} FUCKCOIN</span> {bridgeDirection === "solana-to-evm" ? `from Solana to ${network === "ethereum" ? "Ethereum" : "Base"}!` : `from ${network === "ethereum" ? "Ethereum" : "Base"} to Solana!`}
            </p>
            
            {/* Infos transaction */}
            <div className="bg-[#0f1419] border border-[#293244] rounded-lg p-4 mb-4 text-left">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Transaction:</span>
                <a 
                  href={bridgeDirection === "solana-to-evm" 
                    ? `https://solscan.io/tx/${txHash}` 
                    : network === "ethereum" 
                      ? `https://etherscan.io/tx/${txHash}`
                      : `https://basescan.org/tx/${txHash}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300 underline"
                >
                  View on {bridgeDirection === "solana-to-evm" 
                    ? "Solscan" 
                    : network === "ethereum" 
                      ? "Etherscan" 
                      : "Basescan"
                  }
                </a>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">LayerZero:</span>
                <a 
                  href={`https://layerzeroscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300 underline"
                >
                  Track Bridge
                </a>
              </div>
              <div className="text-sm text-gray-400">
                ⏳ Your tokens will arrive on {bridgeDirection === "solana-to-evm" ? (network === "ethereum" ? "Ethereum" : "Base") : "Solana"} in 1-10 minutes
              </div>
            </div>
            
            {/* Bouton check transaction */}
            <button
              onClick={() => {
                window.open(`https://layerzeroscan.com/tx/${txHash}`, '_blank');
                setIsVisible(false);
                setTimeout(onClose, 300);
              }}
              className="w-full bg-[#151b25] border border-[#293244] hover:bg-[#222936] text-white py-3 px-4 rounded-lg font-semibold transition-colors"
            >
              Check Transaction ✓
            </button>
          </div>
        </div>
      </div>
    </>
  );
}