import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buyback — Charter",
  description: "Confidential share buyback: tender an encrypted quantity into an issuer repurchase offer.",
};

export default function TenderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
