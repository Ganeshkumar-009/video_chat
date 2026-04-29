import type { Metadata } from "next";
import { Inter } from "next/font/google";
import '../globals.css';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Video Chat App",
  description: "Real-time video ^&amp; chat",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body className={inter.className} style={{ backgroundColor: '#0a0a0b', color: 'white' }}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}

