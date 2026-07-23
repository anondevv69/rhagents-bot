export interface SetupStep {
  id: string;
  label: string;
  done: boolean;
  hint?: string;
}

export interface SetupProgress {
  steps: SetupStep[];
  complete: boolean;
  robinhood: boolean;
  rhagents: boolean;
  bankr: boolean;
  platformLinked: boolean;
  managedInferenceRemaining: number | null;
  bankrWalletAddress: string | null;
}

export function isSetupIncomplete(setup?: SetupProgress | null): boolean {
  if (!setup) return true;
  return !setup.robinhood;
}
