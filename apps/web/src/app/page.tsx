import Link from 'next/link';
import { Database, MessageSquare, Sparkles, ArrowRight } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/50 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-accent/20 rounded-full blur-3xl animate-pulse-soft" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-soft animation-delay-500" />
        <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-accent/15 rounded-full blur-3xl animate-pulse-soft animation-delay-300" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between p-4 md:p-6">
        <div className="flex items-center gap-2 animate-fade-in">
          <div className="p-2 rounded-lg bg-gradient-brand">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg">Analytique</span>
        </div>
        <div className="animate-fade-in animation-delay-200">
          <ThemeToggle />
        </div>
      </header>

      <div className="container relative z-10 mx-auto px-4 py-12 md:py-20">
        {/* Hero Section */}
        <div className="text-center mb-16 md:mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full bg-accent/20 text-accent-foreground text-sm animate-fade-in-down border border-accent/30">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Powered by Claude AI</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 animate-fade-in-up bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text">
            Your AI Data Analyst
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in-up animation-delay-100 leading-relaxed">
            Ask questions in natural language and get insights from your Supabase database
            with beautiful visualizations.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <Link
            href="/chat"
            className="group relative p-6 md:p-8 rounded-2xl border bg-card/50 backdrop-blur-sm
                     hover:bg-card hover:border-accent/50 transition-all duration-300
                     hover:-translate-y-1 hover:shadow-xl hover:shadow-accent/10
                     animate-fade-in-up animation-delay-200"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="relative">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 rounded-xl bg-gradient-brand text-white
                              group-hover:scale-110 transition-transform duration-300">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <h2 className="text-xl md:text-2xl font-semibold group-hover:text-accent transition-colors duration-300">
                  Chat with your data
                </h2>
              </div>

              <p className="text-muted-foreground leading-relaxed mb-4">
                Ask questions in plain English. The AI agent will explore your schema, write SQL,
                and visualize results automatically.
              </p>

              <div className="flex items-center gap-2 text-sm font-medium text-accent opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-0 group-hover:translate-x-2">
                Start chatting
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </Link>

          <Link
            href="/schema"
            className="group relative p-6 md:p-8 rounded-2xl border bg-card/50 backdrop-blur-sm
                     hover:bg-card hover:border-accent/50 transition-all duration-300
                     hover:-translate-y-1 hover:shadow-xl hover:shadow-accent/10
                     animate-fade-in-up animation-delay-300"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="relative">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 rounded-xl bg-gradient-brand text-white
                              group-hover:scale-110 transition-transform duration-300">
                  <Database className="h-6 w-6" />
                </div>
                <h2 className="text-xl md:text-2xl font-semibold group-hover:text-accent transition-colors duration-300">
                  Explore schema
                </h2>
              </div>

              <p className="text-muted-foreground leading-relaxed mb-4">
                Browse your database tables, view columns and relationships, and add annotations
                for better AI understanding.
              </p>

              <div className="flex items-center gap-2 text-sm font-medium text-accent opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-0 group-hover:translate-x-2">
                View tables
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </Link>
        </div>

        {/* Footer Badge */}
        <div className="mt-16 md:mt-20 text-center animate-fade-in animation-delay-500">
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-muted/50 backdrop-blur-sm border border-border/50 text-muted-foreground text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>Connected</span>
            </div>
            <span className="w-px h-4 bg-border" />
            <span>Claude AI + Supabase</span>
          </div>
        </div>
      </div>
    </main>
  );
}
