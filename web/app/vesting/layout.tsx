import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Vesting | Charter",
  description: "Confidential cliff-and-linear share vesting over encrypted Charter equity grants.",
};

export default function VestingLayout({ children }: { children: ReactNode }) {
  return children;
}
