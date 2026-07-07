export const SEPOLIA_CHAIN_ID = 11155111;
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const ADDRESSES = {
  shares: process.env.NEXT_PUBLIC_SHARES_ADDRESS ?? ZERO_ADDRESS,
  mcUSD: process.env.NEXT_PUBLIC_MCUSD_ADDRESS ?? ZERO_ADDRESS,
  distributor: process.env.NEXT_PUBLIC_DISTRIBUTOR_ADDRESS ?? ZERO_ADDRESS,
  resolutions: process.env.NEXT_PUBLIC_RESOLUTIONS_ADDRESS ?? ZERO_ADDRESS,
  tender: process.env.NEXT_PUBLIC_TENDER_ADDRESS ?? ZERO_ADDRESS,
  demoFaucet: process.env.NEXT_PUBLIC_DEMO_FAUCET_ADDRESS ?? ZERO_ADDRESS,
  vesting: process.env.NEXT_PUBLIC_VESTING_ADDRESS ?? ZERO_ADDRESS,
  registry: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ?? ZERO_ADDRESS,
  gatedIssuance: process.env.NEXT_PUBLIC_GATED_ISSUANCE_ADDRESS ?? ZERO_ADDRESS,
  guardian: process.env.NEXT_PUBLIC_GUARDIAN_ADDRESS ?? ZERO_ADDRESS,
} as const;

export const CONTRACTS_CONFIGURED = ADDRESSES.shares !== ZERO_ADDRESS;

export const SHARES_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function confidentialBalanceOf(address) view returns (bytes32)",
  "function confidentialTotalSupply() view returns (bytes32)",
  "function totalSharesOnRecord() view returns (uint64)",
  "function recordTimepoint() view returns (uint48)",
  "function supplyDisclosureStale() view returns (bool)",
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

export const DEMO_FAUCET_ABI = [
  "function GRANT() view returns (uint64)",
  "function claimed(address account) view returns (bool)",
  "function claim()",
] as const;

export const DISTRIBUTOR_ABI = [
  "function distributionCount() view returns (uint256)",
  "function getDistribution(uint256 id) view returns (tuple(address token, uint64 pool, uint64 totalShares, uint48 declaredAt))",
  "function paid(uint256 id, address investor) view returns (bool)",
  "function declare(address payToken, uint64 poolAmount) returns (uint256)",
  "function claim(uint256 id)",
  "function payBatch(uint256 id, address[] investors)",
  "function sweep(address token, address to)",
] as const;

export const RESOLUTIONS_ABI = [
  "function resolutionCount() view returns (uint256)",
  "function MIN_VOTERS() view returns (uint32)",
  "function getResolution(uint256 id) view returns (tuple(string description, uint48 snapshot, uint48 deadline, bytes32 forVotes, bytes32 againstVotes, bytes32 passedHandle, uint32 voterCount, bool quorumReached, bool tallyRequested, bool resolved, bool passed))",
  "function hasVoted(uint256 id, address voter) view returns (bool)",
  "function propose(string description, uint48 votingPeriod) returns (uint256)",
  "function castVote(uint256 id, bytes32 encryptedSupport, bytes inputProof)",
  "function requestTally(uint256 id)",
  "function settle(uint256 id, bool passedClear, bytes decryptionProof)",
] as const;

export const TENDER_ABI = [
  "function offerCount() view returns (uint256)",
  "function getOffer(uint256 id) view returns (tuple(address treasury, address paymentToken, uint64 pricePerShare, uint64 maxShares, uint48 deadline, bytes32 totalTendered, bool totalRequested, bool totalSettled, uint64 totalTenderedClear))",
  "function tendered(uint256 id, address holder) view returns (bool)",
  "function openOffer(address paymentToken, uint64 pricePerShare, uint64 maxShares, uint48 votingPeriod) returns (uint256)",
  "function tender(uint256 id, bytes32 encryptedQuantity, bytes inputProof)",
  "function requestTotal(uint256 id)",
  "function settleTotal(uint256 id, uint64 clearTotal, bytes decryptionProof)",
  "function claim(uint256 id, address[] holders)",
] as const;

export const VESTING_ABI = [
  "function grantCount() view returns (uint256)",
  "function getGrant(uint256 id) view returns (tuple(address beneficiary, bytes32 total, bytes32 released, uint48 start, uint48 cliff, uint48 vestingEnd, bool revoked))",
  "function vestingProgress(uint256 id) view returns (uint48 elapsed, uint48 duration)",
  "function createGrant(address beneficiary, bytes32 encryptedTotal, bytes inputProof, uint48 cliffDelay, uint48 vestingDuration) returns (uint256)",
  "function claim(uint256 id)",
  "function revoke(uint256 id)",
] as const;

export const REGISTRY_ABI = [
  "function isAccredited(address account) view returns (bool)",
  "function setAccredited(address account, bool status)",
  "function admin() view returns (address)",
] as const;

export const GATED_ISSUANCE_ABI = ["function issue(address to, bytes32 encryptedAmount, bytes inputProof)"] as const;

export const GUARDIAN_ABI = [
  "function THRESHOLD() view returns (uint32)",
  "function TIMELOCK() view returns (uint48)",
  "function isGuardian(address account) view returns (bool)",
  "function proposalCount() view returns (uint256)",
  "function getProposal(uint256 id) view returns (tuple(address from, address to, bytes32 amount, string reason, uint48 readyAt, uint32 confirmations, bool executed))",
  "function confirmedBy(uint256 id, address guardian) view returns (bool)",
  "function propose(address from, address to, bytes32 encryptedAmount, bytes inputProof, string reason) returns (uint256)",
  "function confirm(uint256 id)",
  "function execute(uint256 id)",
] as const;

export const ZERO_HANDLE = ("0x" + "0".repeat(64)) as `0x${string}`;
