'use client';

import { NavHeader } from '@/components/landing/nav-header';
import { Hero } from '@/components/landing/hero';
import { FeatureShowcase } from '@/components/landing/feature-showcase';
import { DemoSection } from '@/components/landing/demo-section';
import { CtaSection } from '@/components/landing/cta-section';

export default function LandingPage() {
  return (
    <>
      <NavHeader />
      <Hero />
      <FeatureShowcase />
      <DemoSection />
      <CtaSection />
    </>
  );
}
