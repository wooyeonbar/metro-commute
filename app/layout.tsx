export const metadata = {
  title: "출근길 지하철",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0d12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* 홈 화면에 추가 시 전체화면 앱처럼 */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
