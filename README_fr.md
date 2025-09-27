# TsFullStack

[English Document](./README.md) [中文文档](./README_zh.md) [日本語ドキュメント](./README_ja.md) [한국어 문서](./README_ko.md) [Français](./README_fr.md) [Deutsch](./README_de.md) [Español](./README_es.md)

---

Ceci est mon projet de meilleures pratiques TypeScript full-stack. Il permet d'opérer directement sur la base de données depuis le frontend sans écrire de code API backend après avoir défini les modèles de données, permettant un développement rapide de MVP.

> Je suis vraiment fatigué des pages administratives traditionnelles, je ne veux plus jamais en écrire.

[Expérience en ligne](http://tsfullstack.heartstack.space/)

[Documentation IA en ligne du projet](https://zread.ai/2234839/TsFullStack)

[Adresse de la documentation](https://shenzilong.cn/index/TsFullStack.html#20250413211142-d533spm)

## Fonctionnalités

- Backend
  - Stack technique : TypeScript + Prisma + ZenStack + Effect + Fastify
  - ZenStack (solution améliorée basée sur Prisma) pour la modélisation de base de données et la sécurité au niveau des lignes (Row Level Security).

- Pont
  - Stack technique : TypeScript + SuperJSON + bibliothèque RPC maison
  - Le frontend appelle directement les API backend avec une complétion de types TypeScript complète, sans avoir besoin d'écrire de code de couche intermédiaire.
  - SuperJSON prend en charge la sérialisation et désérialisation d'objets complexes comme Date, Map, Set, RegExp..., assurant une transmission transparente des paramètres et résultats Prisma.

- Frontend
  - Stack technique : TypeScript + Vue 3 + Tailwind CSS + bibliothèque de composants PrimeVue
  - Support i18n internationalisation parfait, assurant que chaque détail supporte le changement dynamique de multilingue sans recharger la page.
  - Changement de thème clair/sombre, les composants et Tailwind CSS supportent le changement dynamique synchrone.
  - Quelques pages fonctionnelles implémentées
   - Panneau d'administration de type Prisma Studio (peut servir comme alternative open-source dans une certaine mesure), plus besoin d'écrire des pages CRUD monotones.
   - [NoteCalc](https://tsfullstack.heartstack.space/noteCalc) Un bloc-notes de calcul en temps convivial pour le chinois
   - [AiEnglish](https://tsfullstack.heartstack.space/AiEnglish) Apprendre l'anglais progressivement en lisant

Autres exemples d'applications

- Extension de navigateur - InfoFlow
  - Basée sur https://wxt.dev/guide/installation.html, pour démontrer comment utiliser tsfullstack comme support backend pour les extensions de navigateur.

## Démarrage rapide

1. Cloner le projet
2. Installer les dépendances : entrer dans le répertoire backend, exécuter `pnpm i` pour installer les dépendances (ignorer l'erreur : Failed to resolve entry for package "@tsfullstack/backend", nous générerons ce package dans les étapes suivantes)
3. Initialiser la base de données : dans le répertoire backend, exécuter `pnpm zenstack generate` et `pnpm prisma migrate dev`
4. Compiler le package API @tsfullstack/backend : dans le répertoire backend, exécuter `pnpm build:lib` (il y aura des erreurs de types, je n'ai pas encore trouvé de bonne solution, mais cela n'affecte pas l'utilisation, ne vous en souciez pas)
5. Démarrer le service backend : dans le répertoire backend, exécuter `pnpm dev`
6. Démarrer le service frontend : dans le répertoire website-frontend, exécuter `pnpm dev`

## Conception de la structure du projet

> [Philosophie de conception](https://shenzilong.cn/index/如何实现模块化加载的前端和后端代码.html)

- Base du projet
  - apps/website-frontend est le projet de base frontend
  - apps/backend est le projet de base backend
- Code projet frontend/backend modulaire
  - modules/*
  - Le code frontend à l'intérieur d'un module peut directement référencer les interfaces de code backend internes du module