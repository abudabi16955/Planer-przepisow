# Prototyp aplikacji "Planer przepisów"

Klikalne prototypy z kanwy projektowej (format Design Component `.dc.html`).
Nie renderują się samodzielnie (potrzebują runtime'u edytora) — czytaj je jako źródło:

- `telefon.dc.html` — widok mobilny 390×844 (główny).
- `laptop.dc.html` — widok desktop 1440×900.

W każdym pliku:
- markup w `<x-dc>` = ekrany, teksty UI (po polsku), układ, kolory (inline `style`);
- `<script type="text/x-dc">` = stan, przykładowe dane (`data()`: przepisy, składniki, makro),
  logika przeliczania porcji, planera, celu dziennego i listy zakupów.

Prototyp jest źródłem prawdy dla zakresu funkcji i wyglądu. Dane przykładowe są fikcyjne.

**Nazwa aplikacji: „Planer przepisów”.** W prototypie występuje robocza nazwa „Kuchnia domowa” — w aplikacji używaj nowej nazwy.
