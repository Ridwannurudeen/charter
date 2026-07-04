import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Guardian | Charter",
  description: "Quorum-gated, timelocked force-transfer enforcement for Charter shares.",
};

export default function GuardianLayout({ children }: { children: ReactNode }) {
  return children;
}
