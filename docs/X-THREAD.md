# Charter X Thread Draft

1/ Charter brings private-company equity cap tables on-chain without publishing balances, payouts, or voting weight.
Confidential shares, proof-backed totals, private holder economics. Site: https://charter.gudman.xyz

2/ Issuance is encrypted at the edge. The issuer mints shares to an investor, but the chain receives an encrypted
ERC-7984 handle and input proof, not a clear amount.

3/ Public supply still matters. Charter discloses total issued shares through Zama public decryption, then verifies the
KMS proof on-chain with `FHE.checkSignatures`.

4/ Dividends run over ciphertext. The issuer pauses transfers as the record date, declares a public mcUSD pool, and
investors claim their own pro-rata share with `claim(distributionId)`.

5/ The reveal stays personal. An investor decrypts their own shares and payouts in the browser through an EIP-712
user-decryption session. Membership is public; balances and payouts are not.

6/ Governance uses hidden weight. Shareholders self-delegate, cast encrypted yes/no votes, and only the final pass/fail
outcome is revealed after the voting window. Exact totals are never disclosed.

7/ The stack is built on @zama FHE, OpenZeppelin confidential contracts, and ERC-7984 rails: `ERC7984Rwa`,
`ERC7984Votes`, holder-appointed observer access, and a module registry for dividends/governance.

8/ Links: site https://charter.gudman.xyz, repo https://github.com/Ridwannurudeen/charter, demo video
https://youtu.be/C4BqFngP7rQ. Built for #ZamaDeveloperProgram.
