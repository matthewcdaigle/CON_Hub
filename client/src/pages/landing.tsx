import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Scale, FileSearch, FileText, Bell, BookOpen, Shield } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 h-16">
          <div className="flex items-center gap-2">
            <Scale className="w-6 h-6 text-primary" />
            <span className="font-serif text-lg font-bold tracking-tight">GA CON Counsel</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover-elevate px-2 py-1 rounded-md" data-testid="link-features">Features</a>
            <a href="#about" className="text-sm text-muted-foreground hover-elevate px-2 py-1 rounded-md" data-testid="link-about">About</a>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a href="/api/login">
              <Button data-testid="button-login">Sign In</Button>
            </a>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <p className="text-sm font-medium text-primary tracking-wide uppercase">Georgia Certificate of Need</p>
                <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
                  Master CON Proceedings with Confidence
                </h1>
                <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
                  Track dockets, research precedents, and draft filings with an intelligent platform 
                  purpose-built for Georgia CON practitioners.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a href="/api/login">
                  <Button size="lg" data-testid="button-get-started">
                    Get Started
                  </Button>
                </a>
                <a href="#features">
                  <Button size="lg" variant="outline" data-testid="button-learn-more">
                    Learn More
                  </Button>
                </a>
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-primary" />
                  <span>Secure & Private</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span>Laserfiche Integrated</span>
                </div>
              </div>
            </div>
            <div className="hidden lg:flex justify-center">
              <div className="relative w-full max-w-md">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-accent/20 rounded-md blur-2xl opacity-50" />
                <Card className="relative p-6 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Active Dockets</p>
                      <p className="text-3xl font-bold font-serif">24</p>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-md">
                      <Scale className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">Hearing Scheduled</span>
                      <span className="font-medium">8</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">Under Review</span>
                      <span className="font-medium">12</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">Decision Pending</span>
                      <span className="font-medium">4</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold">Everything You Need</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A comprehensive toolkit designed specifically for Certificate of Need proceedings in Georgia.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Scale,
                title: "Docket Tracking",
                description: "Monitor every CON proceeding in real-time. Track status changes, hearing dates, and key deadlines across all active dockets.",
              },
              {
                icon: FileSearch,
                title: "Research Database",
                description: "Search and browse a curated collection of CON-related documents, decisions, and regulatory guidance with full Laserfiche integration.",
              },
              {
                icon: FileText,
                title: "AI Drafting Assistant",
                description: "Generate first drafts of filings, responses, and briefs using AI trained on Georgia CON procedures and precedents.",
              },
              {
                icon: Bell,
                title: "Docket Alerts",
                description: "Subscribe to specific dockets and receive instant notifications when status changes, new filings, or hearing dates are posted.",
              },
              {
                icon: BookOpen,
                title: "Laserfiche Access",
                description: "Direct links to the public Laserfiche repository for all official proceedings documents and filings.",
              },
              {
                icon: Shield,
                title: "Secure Platform",
                description: "Enterprise-grade security with role-based access control. Your research and drafts are protected.",
              },
            ].map((feature) => (
              <Card key={feature.title} className="p-6 space-y-3 hover-elevate">
                <div className="p-2.5 bg-primary/10 rounded-md w-fit">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="font-serif text-3xl font-bold">Built for Georgia CON Practitioners</h2>
          <p className="text-muted-foreground leading-relaxed">
            Georgia's Certificate of Need process is complex and demanding. Our platform streamlines 
            your workflow by centralizing docket information, providing instant access to the Laserfiche 
            document repository, and offering AI-powered drafting tools tailored to CON proceedings.
          </p>
          <a href="/api/login">
            <Button size="lg" className="mt-4" data-testid="button-start-free">
              Start Using GA CON Counsel
            </Button>
          </a>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4" />
            <span>GA CON Counsel</span>
          </div>
          <p>&copy; {new Date().getFullYear()} All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
