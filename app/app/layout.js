import './globals.css';

export const metadata = {
  title: 'HisaabBot — Voice Finance Assistant',
  description: 'A voice-first AI-powered loan and expense tracker for people who prefer speaking over typing. Manage your finances entirely by voice in Hindi, Gujarati, or English.',
  manifest: '/manifest.json',
  themeColor: '#0a0e17',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="hi">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HisaabBot" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
