# VideoHub Secure

Saubere Startbasis für eine Video-Plattform mit:
- Next.js App Router
- Supabase Auth
- privatem Video-Storage mit signierten URLs
- kostenlosen oder bezahlten Videos
- transparentem Wartungsmodus statt versteckter Hintertür

## Schnellstart

1. Abhängigkeiten installieren:
   ```bash
   npm install
   ```
2. `.env.example` nach `.env.local` kopieren und Supabase-Werte eintragen.
3. In Supabase die SQL aus `sql/schema.sql` ausführen.
4. Einen **privaten** Storage-Bucket `videos` anlegen.
5. Starten:
   ```bash
   npm run dev
   ```

## Sichere Betriebssteuerung

Die Plattform kann bewusst und transparent deaktiviert werden über `app_settings.platform_enabled`.
Das ist als Wartungs- oder Lizenzmodus gedacht. Nicht als versteckte Sabotage. Du betreibst die Plattform nur sauber selbst oder regelst es vertraglich. Alles andere ist juristisch die Art von Improvisation, die später teuer wird.

## Bezahlvideos

Nutzer wählen beim Upload:
- `Kostenlos`
- `Kostenpflichtig`

Für kostenpflichtige Videos ist die Freigabe vorbereitet über die Tabelle `video_purchases`.
Nach erfolgreicher Zahlung setzt dein PSP-Webhook den Datensatz auf `paid`.

## Sicherheitsverbesserungen im Gerüst

- serverseitige Auth-Validierung mit Zod
- private Storage-Nutzung
- signierte URLs statt öffentlicher Dateien
- Dateityp-Whitelist
- Upload-Größenlimit im Client
- RLS auf Tabellenebene
- keine versteckte Backdoor

## Nächste sinnvolle Schritte

- Stripe Checkout + Webhooks
- serverseitiger Upload-Flow mit zusätzlicher Prüfung
- Rate Limiting vor Auth und Kauf-Endpoints
- Admin-Bereich für `app_settings`
- Delete/Edit für Videos
- Thumbnails und Suchindex
