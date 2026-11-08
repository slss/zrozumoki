# zrozumoki

Niezależny serwis edukacyjny o OKI, rozwijany w projekcie slss. Wersja 1.0.0 przygotowana 2026-11-09; źródła podstawowych reguł sprawdzone 2026-11-08. Docelowa domena: `zrozumoki.pl`. Repozytorium: https://github.com/slss/zrozumoki .

## Uruchomienie

Node 24+, bez instalacji zależności:

```sh
npm test
npm run build
npm run check
npm run dev
```

Podgląd: http://localhost:8782/. Build lokalny jest noindex. Serwer nasłuchuje wyłącznie na 127.0.0.1. Build, cache i screeny są ignorowane w Git.

## Zakres

27 stron kalkulatorów obsługujących 28 zaplanowanych sytuacji (kilka kont jest częścią kalkulatora na średnich), 60 poradników i scenariuszy, słownik, przykłady, arkusz wyboru operatora, źródła i metodologia. Formularze i WebMCP korzystają z tego samego kodu. Plany można porównać A/B w pamięci strony, wydrukować oraz zapisać/odczytać z lokalnego pliku JSON.

Rachunek K01 na gotowych średnich 2027 używa groszy i BigInt, przed końcowym zaokrągleniem zobowiązania. Pozostałe modele mają jawne uproszczenia. Historia obejmuje jedno konto przez pełny 2027 i jedną grupę, bez transferów i jednoczesnych wpłat/wypłat. IKE/IKZE: ograniczony model nowych planów z kwalifikowaną wypłatą po 65 latach i minimum 5 lat wpłat. Pełny zakres w `/metodologia/` i przy wyniku. To nie pełne zeznanie ani indywidualna rekomendacja.

## Źródła i utrzymanie

Ustawa OKI: https://eli.gov.pl/eli/DU/2026/1098/ogl/pol . IKE/IKZE: https://eli.gov.pl/api/acts/DU/2024/707/text.html . Dalsze oficjalne źródła są przy konkretnych artykułach. Zapowiedzi instytucji nie są prezentowane jako aktywne oferty.

Własne treści: `content.json`, konfiguracja i opracowanie odbiorców: `site.json`. Wersjonowane źródła w `vendor/core`, generator i UI w `vendor/site`, testy w `vendor/test`. Każdy build działa niezależnie od innych serwisów. Wspólne źródło redakcyjne/silnika: `../../wspolne/`; aktualizacja przez `node ../../wspolne/sync.mjs`, potem test/build/check. Nie ma zależności runtime od innej domeny.

Zmiana reguł wymaga nowej wersji, testów oraz kontroli powiązanych tekstów i przykładów. Nie aktualizuj daty źródeł samym buildem. Kontrola treści stabilnych raz na kwartał i przy zmianie prawa; zapowiedzi instytucji podczas startu rynku co tydzień. Nie uruchomiono automatycznego harmonogramu researchu.

## Publikacja

Workflow `.github/workflows/pages.yml`: testy → configure-pages → build → kontrola HTML/linków → artefakt → deploy-pages. Adres i ścieżka wynikają z configure-pages (`SITE_URL`). Działa pod własną domeną `/` i projektem GitHub `/zrozumoki/`. `robots.txt` pod ścieżką projektu nie steruje całym hostem github.io; sitemap i canonical generowane z rzeczywistego adresu publikacji. Aliasowe adresy prototypu mają canonical docelowy i noindex, nie są w sitemap.

Build produkcyjny lokalnie:

```sh
BUILD_TARGET=production SITE_URL=https://slss.github.io/zrozumoki/ INDEXABLE=true npm run build
npm run check
```

Zmienne repozytorium:

- `CF_WEB_ANALYTICS_TOKEN`: własny publiczny token Cloudflare tej witryny. Bez tokenu skrypt nie jest ładowany.
- `GOOGLE_SITE_VERIFICATION`: token pobrany z procesu weryfikacji właściwej usługi Search Console. Sam tag nie potwierdza weryfikacji i zgłoszenia sitemap.

`BUILD_TARGET`, `SITE_URL` i `INDEXABLE` ustawia workflow. Nie ma kluczy API w kodzie. Prywatność odpowiada faktycznie włączonej analityce. Brak reklam, afiliacji, danych osobistych w adresach i zdarzeniach analitycznych. Warunki GitHub Pages sprawdzono: obecna publikacja edukacyjna bez sprzedaży/SaaS; przed monetyzacją ponownie sprawdzić zgodność hostingu.

Własna domena wymaga DNS, przypisania w Pages, wystawienia certyfikatu i HTTPS. CNAME pojawia się w buildzie tylko dla faktycznej domeny głównej. Weryfikuj publiczny workflow, HTML i działający adres, nie sam push. Szczegóły zakończonej publikacji zapisujemy w `../../research/2026-11-09-wydanie-1.0.0.md`.
