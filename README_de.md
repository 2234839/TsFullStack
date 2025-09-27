# TsFullStack

[English Document](./README.md) [German Document](./README_de.md) [Japanese Document](./README_ja.md) [Korean Document](./README_ko.md) [French Document](./README_fr.md) [Chinese Document](./README_zh.md)

---

Dies ist mein TypeScript-Fullstack-Best-Practice-Projekt. Nach der Definition von Datenmodellen können Sie direkt auf die Datenbank vom Frontend zugreifen, ohne Backend-API-Code schreiben zu müssen, und MVP-Modelle schnell entwickeln.

> Für traditionelle Admin-Oberflächen habe ich wirklich die Nase voll, ich möchte sie nie wieder schreiben.

[Online Demo](http://tsfullstack.heartstack.space/)

[Projekt Online AI Dokumentation](https://zread.ai/2234839/TsFullStack)

[Dokumentationsadresse](https://shenzilong.cn/index/TsFullStack.html#20250413211142-d533spm)

## Funktionen

- Backend
  - Technologiestack: ts + prisma + zenstack + Effect + fastify
  - zenstack (auf Prisma basierende erweiterte Lösung) zur Implementierung von Datenbankmodellierung und Row Level Security.

- Brücke
  - Technologiestack: ts + superjson + selbst entwickelte RPC-Bibliothek
  - Frontend kann direkt Backend-APIs mit vollständigen TypeScript-Typ-Hints aufrufen, ohne Middleware-Code schreiben zu müssen.
  - superjson unterstützt Serialisierung und Deserialisierung komplexer Objekte wie Date, Map, Set, RegExp..., um sicherzustellen, dass Prisma-Eingabeparameter und Rückgabeergebnisse nahtlos übertragen werden können.

- Frontend
  - Technologiestack: ts + vue3 + tailwindcss + primevue Komponentenbibliothek
  - Perfekte i18n-Internationalisierungsunterstützung, um sicherzustellen, dass jedes Detail mehrsprachiges dynamisches Umschalten ohne Neuladen der Seite unterstützt.
  - Hell/Dunkel-Themen-Wechsel, Komponenten und tailwindcss unterstützen synchron dynamisches Umschalten.
  - Implementierte Funktionsseiten
   - Prisma-Studio-ähnliches Admin-Panel (kann bis zu einem gewissen Grad als Open-Source-Alternative dienen), kein Bedarf mehr für das Schreiben von sich wiederholenden CRUD-Seiten.
   - [NoteCalc](https://tsfullstack.heartstack.space/noteCalc) Ein chinesischfreundliches Echtzeit-Berechnungsnotizbuch
   - [AiEnglish](https://tsfullstack.heartstack.space/AiEnglish) Progressives Englischlernen beim Lesen

Weitere Anwendungsbeispiele

- Browser-Erweiterung - InfoFlow
  - Basierend auf https://wxt.dev/guide/installation.html, um zu demonstrieren, wie tsfullstack als Backend-Unterstützung für Browser-Erweiterungen verwendet werden kann.

## Schnellstart

1. Projekt klonen
2. Abhängigkeiten installieren: Wechseln Sie in das Backend-Verzeichnis und führen Sie `pnpm i` aus, um Abhängigkeiten zu installieren (ignorieren Sie den Fehler: Failed to resolve entry for package "@tsfullstack/backend", wir werden dieses Paket in den folgenden Schritten generieren)
3. Datenbank initialisieren: Führen Sie im Backend-Verzeichnis `pnpm zenstack generate` und `pnpm prisma migrate dev` aus
4. @tsfullstack/backend API-Paket kompilieren: Führen Sie im Backend-Verzeichnis `pnpm build:lib` aus (es werden einige Typfehler auftreten, für die ich vorläufig keine gute Lösung gefunden habe, aber dies不影响 die Verwendung, ignorieren Sie es)
5. Backend-Service starten: Führen Sie im Backend-Verzeichnis `pnpm dev` aus
6. Frontend-Service starten: Führen Sie im website-frontend-Verzeichnis `pnpm dev` aus

## Projektstruktur-Design

> [Design-Philosophie](https://shenzilong.cn/index/如何实现模块化加载的前端和后端代码.html)

- Projektbasis
  - apps/website-frontend ist das Frontend-Basisprojekt
  - apps/backend ist das Backend-Basisprojekt
- Modularer Frontend- und Backend-Projektcode
  - modules/*
  - Frontend-Code innerhalb eines Moduls kann direkt Backend-Code-Schnittstellen innerhalb des Moduls referenzieren