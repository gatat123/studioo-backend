'use client';

import { RootLayout } from '@/components/layout';

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RootLayout>{children}</RootLayout>;
}
