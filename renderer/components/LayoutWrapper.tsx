"use client";

import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function FullBleed({ children, className = "" }: CardProps) {
  return (
    <div
      className={`flex h-full w-full flex-1 flex-col overflow-hidden rounded border border-[var(--border-default)] bg-[var(--bg-card)] ${className}`}
    >
      {children}
    </div>
  );
}

export function TableHeader({ children, className = "" }: CardProps) {
  return (
    <thead className={className}>
      {children}
    </thead>
  );
}
