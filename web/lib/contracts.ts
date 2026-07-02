export const SEPOLIA_CHAIN_ID = 11155111;

export const ADDRESSES = {
  shares: process.env.NEXT_PUBLIC_SHARES_ADDRESS ?? "0x0000000000000000000000000000000000000000",
  mcUSD: process.env.NEXT_PUBLIC_MCUSD_ADDRESS ?? "0x0000000000000000000000000000000000000000",
  distributor: process.env.NEXT_PUBLIC_DISTRIBUTOR_ADDRESS ?? "0x0000000000000000000000000000000000000000",
  resolutions: process.env.NEXT_PUBLIC_RESOLUTIONS_ADDRESS ?? "0x0000000000000000000000000000000000000000",
} as const;

export const SHARES_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function confidentialBalanceOf(address) view returns (bytes32)",
  "function confidentialTotalSupply() view returns (bytes32)",
  "function totalSharesOnRecord() view returns (uint64)",
  "function recordTimepoint() view returns (uint48)",
  "function isAdmin(address) view returns (bool)",
  "function isAgent(address) view returns (bool)",
  "function paused() view returns (bool)",
  "function clock() view returns (uint48)",
  "function delegates(address) view returns (address)",
  "function observer(address) view returns (address)",
  "function isOperator(address holder, address spender) view returns (bool)",
  "function confidentialMint(address to, bytes32 encryptedAmount, bytes inputProof) returns (bytes32)",
  "function confidentialTransfer(address to, bytes32 encryptedAmount, bytes inputProof) returns (bytes32)",
  "function delegate(address delegatee)",
  "function setObserver(address account, address newObserver)",
  "function setOperator(address operator, uint48 until)",
  "function pause()",
  "function unpause()",
  "function blockUser(address account)",
  "function unblockUser(address account)",
  "function requestSupplyDisclosure()",
  "function finalizeSupplyDisclosure(uint64 clearSupply, bytes decryptionProof)",
  "event SupplyDisclosed(uint64 totalShares, uint48 recordTimepoint)",
] as const;

export const MCUSD_ABI = [
  "function symbol() view returns (string)",
  "function confidentialBalanceOf(address) view returns (bytes32)",
  "function faucet()",
  "function mint(address to, uint64 amount)",
  "function setOperator(address operator, uint48 until)",
  "function isOperator(address holder, address spender) view returns (bool)",
] as const;

export const DISTRIBUTOR_ABI = [
  "function distributionCount() view returns (uint256)",
  "function getDistribution(uint256 id) view returns (tuple(address token, uint64 pool, uint64 totalShares, uint48 declaredAt))",
  "function paid(uint256 id, address investor) view returns (bool)",
  "function declare(address payToken, uint64 poolAmount) returns (uint256)",
  "function payBatch(uint256 id, address[] investors)",
  "function sweep(address token, address to)",
] as const;

export const RESOLUTIONS_ABI = [
  "function resolutionCount() view returns (uint256)",
  "function getResolution(uint256 id) view returns (tuple(string description, uint48 snapshot, uint48 deadline, bytes32 forVotes, bytes32 againstVotes, bool tallyRequested, bool resolved, uint64 forClear, uint64 againstClear, bool passed))",
  "function hasVoted(uint256 id, address voter) view returns (bool)",
  "function propose(string description, uint48 votingPeriod) returns (uint256)",
  "function castVote(uint256 id, bytes32 encryptedSupport, bytes inputProof)",
  "function requestTally(uint256 id)",
  "function settle(uint256 id, uint64 forClear, uint64 againstClear, bytes decryptionProof)",
] as const;

export const ZERO_HANDLE = ("0x" + "0".repeat(64)) as `0x${string}`;
