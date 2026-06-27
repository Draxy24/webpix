import "./globals.css";
import { Inter, Press_Start_2P } from "next/font/google";
import { AuthProvider } from "./context/auth";
import { SettingsProvider } from "./context/settings";
import { ProfileModalProvider } from "./components/ProfileModalContext";
import { ShopModalProvider } from "./components/ShopModalContext";
import I18nProvider from "./components/I18nProvider";
import { NotificationProvider } from "./components/NotificationProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata = {
  title: "WebPix",
  description: "Lienzo colaborativo de pixel art",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} ${pressStart.variable}`}>
      <head>
        <link
          rel="preconnect"
          href="https://api.webpix.art"
          crossOrigin="anonymous"
        />
        <link
          rel="preconnect"
          href="https://cdn.webpix.art"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <I18nProvider>
          <NotificationProvider>
            <AuthProvider>
              <SettingsProvider>
                <ProfileModalProvider>
                  <ShopModalProvider>{children}</ShopModalProvider>
                </ProfileModalProvider>
              </SettingsProvider>
            </AuthProvider>
          </NotificationProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
