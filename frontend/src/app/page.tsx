import { Header } from "@/components/landing/header"
import { HeroSection } from "@/components/landing/hero-section"
import { FeatureOcr } from "@/components/landing/feature-ocr"
import { FeatureAi } from "@/components/landing/feature-ai"
import { FeatureCommunity } from "@/components/landing/feature-community"
import { CtaSection } from "@/components/landing/cta-section"
import { Footer } from "@/components/landing/footer"

export default function LandingPage() {
  return (
    <main>
      <Header />
      <HeroSection />
      <FeatureOcr />
      <FeatureAi />
      <FeatureCommunity />
      <CtaSection />
      <Footer />
    </main>
  )
}
