# PDFora — PDF Designer

PDFora is a free, browser-based **PDF Designer**. Design polished, customized PDFs in
seconds: add headings, rich text, tables and images, apply themes and fonts, merge in
your own data, and batch-generate documents from a CSV — all with a live preview.

Built with [Nuxt 4](https://nuxt.com), [Nuxt UI](https://ui.nuxt.com) and
[pdf-lib](https://pdf-lib.js.org). PDFs are rendered server-side from a validated schema.

## Features

- **Live preview** that re-renders as you edit.
- **Starter templates** — Invoice, Report, Letter, or a blank canvas.
- **Content blocks** — headings, rich-text paragraphs (bold / italic / color), tables and images.
- **Design controls** — text/heading/accent/background colors, style presets, base font
  (Helvetica, Times, Courier) plus custom TTF/OTF uploads, page size, orientation and margins.
- **Header, body & footer** sections with automatic page numbers (`{{page}}` / `{{pages}}`).
- **Merge fields** — drop `{{client.name}}` style tokens into any text.
- **Batch from CSV** — turn each spreadsheet row into its own PDF and download them as a ZIP.
- **Multiple documents**, undo/redo, and autosave to your browser.

See the in-app [Documentation](/docs) page for a full guide.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev        # http://localhost:3000
```

## Production

```bash
npm run build      # build
npm run preview    # preview the production build
```

Set your public site URL for correct SEO / sitemap / canonical URLs:

```bash
NUXT_PUBLIC_SITE_URL=https://your-domain.com
```

## Tests

```bash
npm test           # vitest run (unit + API e2e)
```

---

Developed by [mdatiqur.me](https://mdatiqur.me).
