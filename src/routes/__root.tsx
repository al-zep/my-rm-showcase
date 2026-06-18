import { useEffect } from "react";
import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import PWAGate from "@/components/PWAGate";
import { registerServiceWorker } from "@/lib/pwa";

import appCss from "../styles.css?url";

const queryClient = new QueryClient();

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lovable App" },
      { name: "description", content: "Elevate Impact Hub is a platform for managing community projects and contributions." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "Elevate Impact Hub is a platform for managing community projects and contributions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Lovable App" },
      { name: "twitter:description", content: "Elevate Impact Hub is a platform for managing community projects and contributions." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/eba1c1ab-ee4b-4e2c-a706-408d2e0f9185/id-preview-b9f17713--5edfe6e0-62a7-4354-b3d7-7e66215535f2.lovable.app-1777124633340.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/eba1c1ab-ee4b-4e2c-a706-408d2e0f9185/id-preview-b9f17713--5edfe6e0-62a7-4354-b3d7-7e66215535f2.lovable.app-1777124633340.png" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Serif+Display&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/sdaLogo.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=new URLSearchParams(location.search);var standalone=(window.navigator&&window.navigator.standalone===true)||(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||(window.matchMedia&&window.matchMedia('(display-mode: fullscreen)').matches)||(window.matchMedia&&window.matchMedia('(display-mode: minimal-ui)').matches);if(p.get('pwa')==='1'||standalone){document.documentElement.classList.add('pwa-booting');}}catch(e){}})();`,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `#pwa-boot-splash{display:none;}html.pwa-booting body{background:#05070d;}html.pwa-booting #app-root{visibility:hidden;}html.pwa-booting #pwa-boot-splash{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(ellipse at top,#1a2238 0%,#0b0f1a 60%,#05070d 100%);color:white;text-align:center;font-family:'Plus Jakarta Sans',system-ui,sans-serif;padding:2rem;}html.pwa-booting #pwa-boot-splash img{width:128px;height:128px;margin-bottom:24px;border-radius:24px;}html.pwa-booting #pwa-boot-splash h1{font-size:1.6rem;font-weight:700;margin:0;letter-spacing:0;}`,
          }}
        />
        <meta name="theme-color" content="#0b0f1a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SDA Contribute" />
        <HeadContent />
      </head>
      <body>
        <div id="pwa-boot-splash" aria-hidden="true">
          <img src="/sdaLogo.png" alt="" />
          <h1>Chuo Kikuu SDA Church</h1>
        </div>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <div id="app-root">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <PWAGate>
              <Outlet />
            </PWAGate>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </div>
  );
}
