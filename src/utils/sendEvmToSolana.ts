// src/utils/sendEvmToSolana.ts
import { ethers } from "ethers";
import bs58 from "bs58";

const OFT_ABI = [
  "function send(tuple(uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd) _sendParam, tuple(uint256 nativeFee, uint256 lzTokenFee) _fee, address _refundAddress) payable returns (tuple(bytes32 guid, uint256 nonce, tuple(uint256 nativeFee, uint256 lzTokenFee) fee))",
  "function quoteSend(tuple(uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd) _sendParam, bool _payInLzToken) view returns (tuple(uint256 nativeFee, uint256 lzTokenFee))",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

export interface EvmToSolanaBridgeParams {
  provider: ethers.providers.Web3Provider;
  tokenAddress: string;
  fromAddress: string;
  toSolanaAddress: string; // Address Solana en base58
  amountUI: string;
  network: "ethereum" | "base";
}

// Convertir address Solana (base58) vers bytes32
function solanaAddressToBytes32(solanaAddress: string): string {
  try {
    // Décoder l'adresse base58 en bytes
    const decoded = bs58.decode(solanaAddress);
    // Convertir en hex et padder à 32 bytes
    const hex = Buffer.from(decoded).toString('hex').padStart(64, '0');
    return '0x' + hex;
  } catch (error) {
    throw new Error(`Adresse Solana invalide: ${solanaAddress}`);
  }
}

export async function sendEvmToSolana({
  provider,
  tokenAddress,
  fromAddress,
  toSolanaAddress,
  amountUI,
  network
}: EvmToSolanaBridgeParams): Promise<string> {
  console.log("🌉 Début du bridge EVM → Solana");
  console.log("📋 Paramètres:", {
    tokenAddress,
    fromAddress,
    toSolanaAddress,
    amountUI,
    network
  });

  const signer = provider.getSigner();
  const contract = new ethers.Contract(tokenAddress, OFT_ABI, signer);
  
  // EID de destination (Solana)
  const SOLANA_EID = 30168;
  
  try {
    // 1. Obtenir les décimales du token
    const decimals = await contract.decimals();
    console.log("🔢 Décimales token:", decimals);
    
    // 2. Convertir le montant
    const amountLD = ethers.utils.parseUnits(amountUI, decimals);
    console.log("💰 Montant à bridge:", ethers.utils.formatUnits(amountLD, decimals));
    
    // 3. Convertir l'adresse Solana
    const toBytes32 = solanaAddressToBytes32(toSolanaAddress);
    console.log("📍 Destination Solana (bytes32):", toBytes32);
    
    // 4. Préparer les paramètres de bridge
    const sendParam = {
      dstEid: SOLANA_EID,
      to: toBytes32,
      amountLD: amountLD,
      minAmountLD: amountLD, // Pas de slippage pour l'instant
      extraOptions: "0x", // Options par défaut
      composeMsg: "0x", // Pas de composition
      oftCmd: "0x" // Pas de commande OFT
    };
    
    // 5. Quote des frais
    console.log("💸 Calcul des frais...");
    const feeQuote = await contract.quoteSend(sendParam, false);
    console.log("📊 Frais natifs:", ethers.utils.formatEther(feeQuote.nativeFee), "ETH");
    
    // 6. Vérifier l'allowance (si nécessaire)
    const allowance = await contract.allowance(fromAddress, tokenAddress);
    if (allowance.lt(amountLD)) {
      console.log("🔓 Approbation nécessaire...");
      const approveTx = await contract.approve(tokenAddress, amountLD);
      console.log("⏳ Attente de l'approbation...");
      await approveTx.wait();
      console.log("✅ Approbation confirmée");
    }
    
    // 7. Exécuter le bridge
    console.log("🚀 Envoi de la transaction de bridge...");
    const bridgeTx = await contract.send(
      sendParam,
      feeQuote,
      fromAddress, // refund address
      {
        value: feeQuote.nativeFee // Payer les frais en natif
      }
    );
    
    console.log("⏳ Attente de confirmation...");
    const receipt = await bridgeTx.wait();
    console.log("✅ Bridge confirmé!");
    
    const explorerUrl = network === "ethereum" 
      ? `https://etherscan.io/tx/${receipt.transactionHash}`
      : `https://basescan.org/tx/${receipt.transactionHash}`;
    
    console.log(`🔍 Explorer: ${explorerUrl}`);
    console.log(`🔗 LayerZero: https://layerzeroscan.com/tx/${receipt.transactionHash}`);
    console.log("⏳ Vos tokens arriveront sur Solana dans 1-10 minutes");
    
    return receipt.transactionHash;
    
  } catch (error: any) {
    console.error("❌ Erreur bridge EVM→Solana:", error);
    throw error;
  }
}