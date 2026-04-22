import './globals.css'

export const metadata = {
  title: 'VideoHub Secure',
  description: 'Video-Plattform mit Login, Upload und bezahlten Inhalten',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
