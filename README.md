# Muri Rasoi — Restaurant Website

A single-page restaurant website for Muri Rasoi (Muri, Jharkhand), built with
React, Vite, and Tailwind CSS.

## Getting started

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

To build for production:

```bash
npm run build
npm run preview
```

## Adding your real photos

**No images were supplied with the original brief**, so the site currently
shows clearly-labeled placeholder blocks (in the restaurant's purple/magenta
palette) everywhere a real photo belongs — hero background, interior shots,
gallery, and dish photos.

See `public/images/README.md` for the exact list of filenames the site
expects. Drop matching files into `public/images/` and they appear
automatically, no code edits required.

## Editing the menu

`src/data/menu.js` holds all menu items as a plain array — name, category,
description, image filename, and price. Prices are `null` until you add real
ones (the UI shows "Ask server" instead of guessing a number). Add, remove,
or edit entries there; the Menu and Popular Dishes sections both read from
this one file.

## Project structure

```
src/
  components/   One component per section (Navbar, Hero, Menu, Gallery, ...)
  data/menu.js  Menu items — edit this to add real dishes & prices
  App.jsx       Assembles all sections in order
public/
  images/       Drop real restaurant photos here (see README.md inside)
```

## What's already wired up

- Sticky navbar that compacts on scroll, with a mobile hamburger menu
- Call (`tel:`), WhatsApp (`wa.me`), and Google Maps links, all using the
  real numbers/URL from the brief
- An embedded Google Map of the restaurant's location
- Category-filterable menu
- Masonry gallery with a keyboard-and-touch-friendly lightbox
- The three real Google review snippets from the brief, clearly labeled
- SEO: title, meta description, Open Graph tags, and LocalBusiness
  structured data (JSON-LD) built only from information in the brief
- Fade-up section reveals, image hover-zoom, and a subtle neon glow accent —
  respects `prefers-reduced-motion`
