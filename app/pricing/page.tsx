import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">KnowledgeAgent</p>
            <p className="text-xs text-muted-foreground truncate">Pricing (mockup)</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/">Back to dashboard</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground text-balance">Pricing</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
            Mockup pricing page. All prices are placeholders.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Starter</CardTitle>
              <CardDescription>For trying out the pipeline</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-3xl font-semibold text-foreground">xxx</p>
                <p className="text-xs text-muted-foreground">per month</p>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                <li>Document processing</li>
                <li>RAG chat API key</li>
                <li>Basic support</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full">
                <Link href="/">Get started</Link>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pro</CardTitle>
              <CardDescription>For production usage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-3xl font-semibold text-foreground">xxx</p>
                <p className="text-xs text-muted-foreground">per month</p>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                <li>Higher throughput</li>
                <li>More collections</li>
                <li>Priority support</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full">
                <Link href="/">Choose Pro</Link>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enterprise</CardTitle>
              <CardDescription>For teams and custom needs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-3xl font-semibold text-foreground">xxx</p>
                <p className="text-xs text-muted-foreground">contact us</p>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                <li>Custom deployment</li>
                <li>Security reviews</li>
                <li>SLA / support</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild variant="secondary" className="w-full">
                <Link href="/">Contact sales</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  );
}
