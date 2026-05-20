import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Utensils,
  BarChart3,
  ShoppingBag,
  ArrowRight,
  Store,
  Sparkles,
} from "lucide-react";
import { useState, useEffect } from "react";
import type { Settings } from "@shared/schema";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    setLogoError(false);
  }, [settings?.businessLogo]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get("redirect");
    if (redirect) setRedirectUrl(redirect);
  }, []);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return await response.json();
    },
    onSuccess: async () => {
      toast({ title: "Login successful", description: "Welcome back!" });
      await new Promise((resolve) => setTimeout(resolve, 100));
      await queryClient.refetchQueries({
        queryKey: ["/api/auth/session"],
        exact: true,
      });
      if (redirectUrl) {
        if (window.opener && !window.opener.closed) {
          try {
            const redirectOrigin = new URL(redirectUrl).origin;
            window.opener.postMessage(
              { type: "AUTH_SUCCESS", message: "Authentication successful" },
              redirectOrigin
            );
            setTimeout(() => window.close(), 500);
          } catch {
            window.location.href = redirectUrl;
          }
        } else {
          window.location.href = redirectUrl;
        }
      } else {
        setLocation("/dashboard");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginFormData) => loginMutation.mutate(data);

  const goToCustomerPortal = () => setLocation("/menu");

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gradient-to-br from-slate-50 via-white to-primary/5 dark:from-background dark:via-background dark:to-primary/10">
      {/* Left: Login card + Customer portal CTA */}
      <div className="w-full lg:w-[480px] shrink-0 flex flex-col justify-center px-4 sm:px-6 lg:px-12 py-8 lg:py-12">
        <div className="w-full max-w-sm mx-auto space-y-8">
          {/* Logo & app name */}
          <div className="flex items-center gap-3">
            {settings?.businessLogo && !logoError ? (
              <img
                src={settings.businessLogo}
                alt={settings.appName || "Logo"}
                className="w-10 h-10 rounded-xl object-contain bg-primary/10 p-1.5 shrink-0 shadow-sm"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Utensils className="w-5 h-5 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                {settings?.appName || "POS"}
              </h1>
              <p className="text-xs text-muted-foreground">Staff & management</p>
            </div>
          </div>

          {/* Staff sign-in card */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-lg shadow-black/5 dark:shadow-none p-6 sm:p-8 space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Staff sign in</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Use your account to access the dashboard
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            {...field}
                            data-testid="input-username"
                            placeholder="Username"
                            autoComplete="username"
                            disabled={loginMutation.isPending}
                            className="pl-9 h-11 bg-muted/30 border-border/80 focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-destructive text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            {...field}
                            data-testid="input-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
                            autoComplete="current-password"
                            disabled={loginMutation.isPending}
                            className="pl-9 pr-10 h-11 bg-muted/30 border-border/80 focus:ring-2 focus:ring-primary/20"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-destructive text-xs" />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  data-testid="button-login"
                  className="w-full h-11 font-medium"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </Form>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              or
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Customer web portal CTA */}
          <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 dark:bg-primary/10 p-5 sm:p-6 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/15 text-primary">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">I'm a customer</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Browse the menu and order online. No account needed.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 font-medium gap-2 border-primary/40 bg-background/80 hover:bg-primary/10 hover:border-primary/60"
              onClick={goToCustomerPortal}
            >
              <ShoppingBag className="w-4 h-4" />
              View customer web portal
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
          </div>
        </div>
      </div>

      {/* Right: Customer-focused hero */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 lg:p-16 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent dark:from-primary/20 dark:via-primary/10 dark:to-transparent rounded-l-3xl border-l border-border/50">
        <div className="max-w-md text-center space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-2 text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            Order online
          </div>
          <div>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
              {settings?.websiteTitle || settings?.appName || "Order from our menu"}
            </h2>
            <p className="text-muted-foreground mt-3 text-base leading-relaxed">
              {settings?.websiteDescription ||
                "Browse products, add to cart, and place your order in a few taps. No sign-in required."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-left">
            <div className="rounded-xl bg-background/60 dark:bg-card/50 border border-border/50 p-4 space-y-2">
              <ShoppingBag className="w-8 h-8 text-primary" />
              <p className="text-sm font-medium text-foreground">Browse menu</p>
              <p className="text-xs text-muted-foreground">Filter by category & search</p>
            </div>
            <div className="rounded-xl bg-background/60 dark:bg-card/50 border border-border/50 p-4 space-y-2">
              <BarChart3 className="w-8 h-8 text-primary" />
              <p className="text-sm font-medium text-foreground">Quick checkout</p>
              <p className="text-xs text-muted-foreground">Name, phone & place order</p>
            </div>
          </div>

          <Button
            size="lg"
            className="gap-2 shadow-lg"
            onClick={goToCustomerPortal}
          >
            <Store className="w-5 h-5" />
            Open customer portal
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
