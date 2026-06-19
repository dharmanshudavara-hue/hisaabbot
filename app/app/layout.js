import './globals.css';
import { Analytics } from '@vercel/analytics/next';

export const metadata = {
  title: 'HisaabBot — Voice Finance Assistant',
  description: 'A voice-first AI-powered loan and expense tracker for people who prefer speaking over typing. Manage your finances entirely by voice in Hindi, Gujarati, or English.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport = {
  themeColor: '#0a0e17',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import AuthGuard from './components/AuthGuard';

export default function RootLayout({ children }) {
  return (
    <html lang="hi">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HisaabBot" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body>
        <AuthGuard>
          {children}
        </AuthGuard>
        <ServiceWorkerRegistration />
        <Analytics />
      </body>
    </html>
  );
}

function ServiceWorkerRegistration() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js')
                .then(function(reg) { console.log('SW registered:', reg.scope); })
                .catch(function(err) { console.log('SW registration failed:', err); });
            });
          }
        `,
      }}
    />
  );
}
