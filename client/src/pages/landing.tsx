import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Scale,
  FileSearch,
  Bell,
  BookOpen,
  Shield,
  Loader2,
  Eye,
  Timer,
  Brain,
  Landmark,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";

export default function Landing() {
  const [demoLoading, setDemoLoading] = useState(false);

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      const res = await fetch("/api/auth/demo-login", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        window.location.href = "/";
      }
    } catch {
      // silently handle
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 h-16">
          <div className="flex items-center gap-2">
            <Landmark className="w-6 h-6 text-primary" />
            <span className="font-serif text-lg font-bold tracking-tight">
              Georgia CON Hub
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a
              href="#features"
              className="text-sm text-muted-foreground hover-elevate px-2 py-1 rounded-md"
              data-testid="link-features"
            >
              Features
            </a>
            <a
              href="#about"
              className="text-sm text-muted-foreground hover-elevate px-2 py-1 rounded-md"
              data-testid="link-about"
            >
              About
            </a>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a href="/api/auth/google">
              <Button data-testid="button-login">Sign In</Button>
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <p className="text-sm font-medium text-primary tracking-wide uppercase">
                  State of Georgia -- Certificate of Need
                </p>
                <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
                  Georgia CON Monitoring Hub
                </h1>
                <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
                  Monitor Certificate of Need proceedings, track critical
                  deadlines, and stay informed on all CON, Determination, and
                  equipment filings across the State of Georgia.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a href="/api/auth/google">
                  <Button size="lg" data-testid="button-sign-in-google">
                    <Shield className="w-4 h-4 mr-2" />
                    Sign in with Google
                  </Button>
                </a>
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={handleDemoLogin}
                  disabled={demoLoading}
                  data-testid="button-demo-login"
                >
                  {demoLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Demo Login
                </Button>
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
                <div className="flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-primary" />
                  <span>Georgia DCH Data</span>
                </div>
              </div>
            </div>
            <div className="hidden lg:flex justify-center">
              <div className="relative w-full max-w-md">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-accent/20 rounded-md blur-2xl opacity-50" />
                <Card className="relative p-6 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Active Proceedings
                      </p>
                      <p className="text-3xl font-bold font-serif">--</p>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-md">
                      <Scale className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">
                        CON Applications
                      </span>
                      <span className="font-medium font-mono">--</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Determinations
                      </span>
                      <span className="font-medium font-mono">--</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Upcoming Deadlines
                      </span>
                      <span className="font-medium font-mono">--</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    Sign in to view live data
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold">
              Everything You Need to Monitor Georgia CON
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A comprehensive platform designed for healthcare attorneys,
              consultants, and stakeholders tracking Certificate of Need
              proceedings in Georgia.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Eye,
                title: "Monitor Proceedings",
                description:
                  "Track all CON, DET, DET-EQT, and DET-ASC filings across every Georgia county. View real-time status updates and case details.",
              },
              {
                icon: Timer,
                title: "Track Deadlines",
                description:
                  "Never miss a critical deadline. Automatic tracking of LOI expirations, opposition windows, hearing dates, and appeal periods.",
              },
              {
                icon: FileSearch,
                title: "Competitive Intelligence",
                description:
                  "Monitor competitor filings, proximity alerts for nearby applications, and track the competitive landscape for your clients.",
              },
              {
                icon: Brain,
                title: "AI-Powered Analysis",
                description:
                  "Generate case briefs, analyze filings with AI, and draft responses using intelligent tools trained on Georgia CON precedents.",
              },
            ].map((feature) => (
              <Card key={feature.title} className="p-6 space-y-3 hover-elevate">
                <div className="p-2.5 bg-primary/10 rounded-md w-fit">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Process overview */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <h2 className="font-serif text-3xl font-bold">
              Georgia CON Process Coverage
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We track every stage of the Certificate of Need process as
              administered by the Georgia Department of Community Health.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "CON",
                desc: "Certificate of Need",
                color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
              },
              {
                label: "DET",
                desc: "Determination",
                color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
              },
              {
                label: "DET-EQT",
                desc: "Equipment Determination",
                color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
              },
              {
                label: "DET-ASC",
                desc: "ASC Determination",
                color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
              },
            ].map((type) => (
              <Card key={type.label} className="p-4 text-center space-y-2">
                <div
                  className={`inline-flex px-3 py-1 rounded-md text-sm font-semibold ${type.color}`}
                >
                  {type.label}
                </div>
                <p className="text-sm text-muted-foreground">{type.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* About / CTA Section */}
      <section id="about" className="py-20 bg-card/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="font-serif text-3xl font-bold">
            Built for Georgia CON Practitioners
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Georgia's Certificate of Need process is complex and demanding. Our
            platform streamlines your workflow by centralizing all proceeding
            data from the Georgia Department of Community Health, providing
            Laserfiche document integration, deadline tracking, and AI-powered
            analysis tools built specifically for CON proceedings.
          </p>
          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <a href="/api/auth/google">
              <Button size="lg" data-testid="button-get-started">
                <Shield className="w-4 h-4 mr-2" />
                Sign in with Google
              </Button>
            </a>
            <Button
              size="lg"
              variant="outline"
              onClick={handleDemoLogin}
              disabled={demoLoading}
              data-testid="button-demo-login-bottom"
            >
              {demoLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Try Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4" />
            <span>Georgia CON Monitoring Hub</span>
          </div>
          <p>&copy; {new Date().getFullYear()} All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
