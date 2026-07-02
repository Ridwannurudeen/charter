"use client";

import { useState } from "react";

import { CONTRACTS_CONFIGURED } from "@/lib/contracts";

export function DeploymentBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (CONTRACTS_CONFIGURED || dismissed) return null;

  return (
    <div className="mb-6 rounded-lg border border-primary/35 bg-primary/10 px-4 py-3 text-sm leading-relaxed text-primary-bright">
      <div className="flex items-start justify-between gap-3">
        <p>Contracts not yet deployed - this is a UI preview. See README for the live deployment.</p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-primary-bright transition-colors duration-150 hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label="Dismiss deployment preview banner"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
