"use client";

import * as React from "react";

interface StyleWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  styleName?: string;
}

export function StyleWrapper({ styleName, children }: StyleWrapperProps) {
  // Always render children since we're using a single style
  return <>{children}</>;
}
