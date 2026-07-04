import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Compliance | Charter",
  description: "Default-deny accredited issuance over encrypted Charter equity.",
};

export default function ComplianceLayout({ children }: { children: ReactNode }) {
  return children;
}
