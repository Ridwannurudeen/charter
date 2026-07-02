# Charter X thread draft

1/ Charter brings private-company cap tables on-chain without publishing the cap table. Verifiable totals, hidden
individuals. Site: [live URL]

2/ Issuance is encrypted at the edge. The issuer mints 500,000 shares to an investor, but the chain receives an
encrypted ERC-7984 handle and input proof, not a clear amount.

3/ Public supply still matters. Charter discloses total issued shares through Zama public decryption, then verifies the
KMS proof on-chain with `FHE.checkSignatures`.

4/ Dividends run over ciphertext. The issuer declares a public mcUSD pool, pauses transfers as the record date, and
`payBatch` computes `encrypted balance * pool / total shares` for each investor.

5/ The reveal stays personal. An investor decrypts their own shares and payouts in the browser through an EIP-712
user-decryption session. Nothing is published for competitors to scrape.

6/ Governance uses hidden weight. Shareholders self-delegate, cast encrypted yes/no votes, and only the final
for/against totals are revealed after the voting window.

7/ The stack is built on @zama FHE, OpenZeppelin confidential contracts, and ERC-7984 rails: `ERC7984Rwa`,
`ERC7984Votes`, and holder-appointed observer access for auditors.

8/ Links: site [live URL], repo https://github.com/gudmanii/charter, demo video [video URL]. Built for
#ZamaDeveloperProgram.
