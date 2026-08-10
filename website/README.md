# Rilo Website (GitHub Pages)

This directory contains the official single-page static website for the **Rilo** desktop download manager.

---

## Structure

```
website/
├── index.html              # Main HTML5 landing page
├── style.css               # Master CSS design system and responsive styles
├── script.js               # Vanilla JavaScript for header scroll, lightbox, and menu
├── assets/
│   ├── logo.png            # Rilo logo icon
│   ├── favicon.ico         # Website favicon
│   └── screenshots/
│       ├── img.png         # Main Rilo desktop interface screenshot
│       ├── extension.png   # WebExtension popup screenshot
│       └── mermaid.png     # System architecture flowchart
└── README.md               # Documentation & local server guide
```

---

## Local Development & Testing

Since the website is completely static (HTML5, CSS3, Vanilla JS), no Node.js compilation or build steps are required.

### Method 1: Python HTTP Server (Recommended)

Run the Python built-in web server from the repository root:

```bash
python -m http.server 8080 --directory website
```

Then open your browser at:
`http://localhost:8080`

### Method 2: Node / npx serve

```bash
npx serve website
```

Then open your browser at the local URL printed in the terminal.

---

## Deployment to GitHub Pages

The website is configured to be automatically published via GitHub Actions.

### Automated GitHub Actions Workflow

When changes are pushed to the `main` branch, the workflow defined in `.github/workflows/pages.yml` builds and deploys the contents of the `website/` directory to GitHub Pages.

### Manual GitHub Pages Settings Setup

Alternatively, if deploying directly from repository settings:
1. Go to your repository **Settings** on GitHub (`https://github.com/kmanisk/rilo/settings`).
2. Navigate to **Pages** in the left sidebar.
3. Under **Build and deployment**:
   - Source: Select **GitHub Actions** (or select **Deploy from a branch** and choose `/website` or `/docs`).
4. Save settings.

---

## Release Links Configuration

All download buttons link dynamically to the latest GitHub release assets:
- **Desktop Executable**: `https://github.com/kmanisk/rilo/releases/latest/download/rilo.exe`
- **GitHub Releases Page**: `https://github.com/kmanisk/rilo/releases`
- **GitHub Repository**: `https://github.com/kmanisk/rilo`
