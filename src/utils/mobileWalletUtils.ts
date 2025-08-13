// src/utils/mobileWalletUtils.ts
"use client";

export const isMobile = () => {
  return typeof window !== "undefined" && 
    (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
     window.innerWidth <= 768);
};

export const isInAppBrowser = () => {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('wv') || ua.includes('webview') || 
         ua.includes('instagram') || ua.includes('twitter') ||
         ua.includes('facebook') || ua.includes('linkedin');
};

// Fonctions de redirection supprimées pour éviter les redirections automatiques

export const detectMobileWallets = () => {
  if (typeof window === "undefined") {
    return { phantom: false, metamask: false, inApp: { phantom: false, metamask: false }, currentApp: null };
  }
  
  // Détection simple et directe des objets injectés
  const hasPhantom = !!(window as any).phantom?.solana;
  const hasEthereumProvider = !!(window as any).ethereum;
  
  // Debug logs
  if (isMobile()) {
    console.log('🔍 Mobile wallet detection:', {
      phantom: hasPhantom,
      ethereum: hasEthereumProvider,
      phantomObj: (window as any).phantom,
      ethereumObj: (window as any).ethereum,
      userAgent: navigator.userAgent
    });
  }
  
  return {
    phantom: hasPhantom,
    metamask: hasEthereumProvider,
    inApp: {
      phantom: false,
      metamask: false
    },
    currentApp: null,
    canConnectBoth: true
  };
};