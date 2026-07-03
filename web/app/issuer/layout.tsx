import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Issuer Console | Charter",
};

export default function IssuerLayout({ children }: { children: ReactNode }) {
  return children;
}
