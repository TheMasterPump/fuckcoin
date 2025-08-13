import { PublicKey } from "@solana/web3.js";

export function calcPeerPDA(
  oftStore: string,
  remoteEid: number,
  oftProgramId: string
): PublicKey {
  const seed1 = Buffer.from("Peer");
  const seed2 = new PublicKey(oftStore).toBuffer();

  const seed3 = Buffer.alloc(4);
  seed3.writeUInt32BE(remoteEid, 0);

  const programKey = new PublicKey(oftProgramId); // ✅ conversion string → PublicKey

  const [peerPDA] = PublicKey.findProgramAddressSync(
    [seed1, seed2, seed3],
    programKey
  );

  return peerPDA;
}
