"use client";

import { createContext, useContext } from "react";

const ViewerModeContext = createContext({ readOnly: false });

export function ViewerModeProvider({
  readOnly,
  children,
}: {
  readOnly: boolean;
  children: React.ReactNode;
}) {
  return <ViewerModeContext.Provider value={{ readOnly }}>{children}</ViewerModeContext.Provider>;
}

export function useViewerReadOnly(): boolean {
  return useContext(ViewerModeContext).readOnly;
}
