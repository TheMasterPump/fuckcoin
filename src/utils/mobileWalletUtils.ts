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

export const createDeepLink = (walletName: string, dappUrl?: string) => {
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";
  const encodedUrl = encodeURIComponent(dappUrl || currentUrl);
  
  switch (walletName.toLowerCase()) {
    case 'phantom':
      return `phantom://browse/${encodedUrl}?ref=${encodedUrl}`;
    
    case 'metamask':
      return `metamask://dapp/${encodedUrl.replace('https://', '')}`;
    
    case 'backpack':
      return `backpack://browse/${encodedUrl}`;
    
    case 'solflare':
      return `solflare://browse/${encodedUrl}`;
    
    default:
      return null;
  }
};

export const redirectToWallet = (walletName: string, dappUrl?: string) => {
  if (!isMobile()) return false;
  
  const deepLink = createDeepLink(walletName, dappUrl);
  if (!deepLink) return false;
  
  try {
    // Créer un lien temporaire et le cliquer (plus fiable sur mobile)
    const link = document.createElement('a');
    link.href = deepLink;
    link.target = '_blank';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Fallback vers le store après 3 secondes si l'app n'est pas installée
    setTimeout(() => {
      if (!document.hidden) {
        const storeUrl = getStoreUrl(walletName);
        if (storeUrl) {
          window.open(storeUrl, '_blank');
        }
      }
    }, 3000);
    
    return true;
  } catch (error) {
    console.error(`Erreur redirection ${walletName}:`, error);
    // Fallback direct vers le store
    const storeUrl = getStoreUrl(walletName);
    if (storeUrl) {
      window.open(storeUrl, '_blank');
      return true;
    }
    return false;
  }
};

export const getStoreUrl = (walletName: string) => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  switch (walletName.toLowerCase()) {
    case 'phantom':
      return isIOS 
        ? 'https://apps.apple.com/app/phantom-solana-wallet/id1598432977'
        : 'https://play.google.com/store/apps/details?id=app.phantom';
    
    case 'metamask':
      return isIOS 
        ? 'https://apps.apple.com/app/metamask/id1438144202'
        : 'https://play.google.com/store/apps/details?id=io.metamask';
    
    case 'backpack':
      return isIOS 
        ? 'https://apps.apple.com/app/backpack-crypto-wallet/id1644542104'
        : 'https://play.google.com/store/apps/details?id=com.backpack.mobile';
    
    case 'solflare':
      return isIOS 
        ? 'https://apps.apple.com/app/solflare/id1580902717'
        : 'https://play.google.com/store/apps/details?id=com.solflare.mobile';
    
    default:
      return null;
  }
};

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