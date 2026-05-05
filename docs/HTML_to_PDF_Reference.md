# HTML → PDF Conversion Reference
**Perfected technique for pixel-perfect, page-snug PDF output**

---

## The Stack
- **Renderer:** Playwright (headless Chromium)
- **Page size:** US Letter = 816 × 1056px at 96dpi
- **Install:** `pip install playwright --break-system-packages && playwright install chromium`

---

## The Render Script

```python
import asyncio
from playwright.async_api import async_playwright

async def render_pdf(html_path, pdf_path):
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 816, "height": 1056})
        await page.goto(f"file://{html_path}", wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(3000)  # Let fonts/images fully load
        await page.pdf(
            path=pdf_path,
            format="Letter",
            print_background=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            prefer_css_page_size=True
        )
        await browser.close()

asyncio.run(render_pdf("/absolute/path/to/file.html", "/absolute/path/to/output.pdf"))
```

---

## Height Measurement Script (run BEFORE final render)

Use this to check every section fits within 1056px before committing to the PDF.

```python
import asyncio
from playwright.async_api import async_playwright

async def measure_sections(html_path):
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 816, "height": 1056})
        await page.goto(f"file://{html_path}", wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        heights = await page.evaluate("""
        () => {
            const covers  = document.querySelectorAll('.cover');
            const sections = document.querySelectorAll('.section-page');
            const results = {};
            covers.forEach((el, i)   => results['cover_' + i]   = Math.round(el.getBoundingClientRect().height));
            sections.forEach((el, i) => results['section_' + i] = Math.round(el.getBoundingClientRect().height));
            return results;
        }
        """)

        all_ok = True
        for k, v in sorted(heights.items()):
            flag = " ⚠️  OVERFLOW" if v > 1056 else " ✓"
            if v > 1056: all_ok = False
            print(f"  {k}: {v}px{flag}")

        print("\n✅ All good!" if all_ok else "\n⚠️  Fix overflows before rendering.")
        await browser.close()

asyncio.run(measure_sections("/absolute/path/to/file.html"))
```

---

## Critical CSS Rules

### Page container — use px, NOT vh
```css
/* ✅ Correct — reliable in headless PDF */
.section-page {
  min-height: 1056px;
  width: 816px;
}

/* ❌ Wrong — 100vh is unreliable in Playwright headless mode */
.section-page {
  min-height: 100vh;
}
```

### @page rule — zero margins, Letter size
```css
@page {
  size: Letter;
  margin: 0;
}
```

### Page breaks — belt AND suspenders
```css
.section-page {
  page-break-before: always;
  page-break-after: always;
  break-before: page;   /* modern syntax */
  break-after: page;    /* modern syntax */
}
```

### Prevent elements splitting across pages
```css
.card, .table, .important-block {
  page-break-inside: avoid;
  break-inside: avoid;
}
```

### Background color must match everywhere
```css
/* If sections have cream background, body must too —
   otherwise you get white/grey gaps between pages */
html, body {
  background: var(--cream); /* must match .section-page background */
}
```

---

## Layout Constraints for One Page = One Section

| Element | Max recommended | Notes |
|---|---|---|
| Section padding (top+bottom) | 44px total | e.g. `padding: 22px 44px` |
| Base font size | 12–12.5px | Any larger = more overflow risk |
| Line height | 1.45–1.55 | Tighter than browser default |
| Card padding | 10–14px | Not 20px+ |
| Margin between cards | 6–8px | Not 14px+ |
| Table cell padding | 8–10px | Not 12–16px |

---

## Compression Checklist (when sections overflow)

When `section height > 1056px`, apply these in order:

1. **Global font size** — drop to 12.5px or 12px
2. **Padding on all containers** — cut by 30–40%
3. **Margin between cards** — cut to 6–8px max
4. **Table cell padding** — cut to 8–10px
5. **Line heights on body text** — try 1.45
6. **Structural redesign** — e.g. vertical list → 2×2 CSS grid (biggest wins)
7. **Content trim** — shorten text, remove a row, merge elements

**Rule:** measure after every change. Don't guess.

---

## Common Pitfalls

| Problem | Cause | Fix |
|---|---|---|
| White gaps between pages | Body background ≠ section background | Match `html, body { background }` to section background |
| Last element pushed to new page | Section slightly overflows | Measure and trim — usually a margin or padding issue |
| Fonts not rendering | Google Fonts not loaded in time | Add `wait_for_timeout(3000)` after `networkidle` |
| `100vh` wrong size | Playwright viewport ≠ page height in PDF mode | Use `min-height: 1056px` (hard pixels) |
| Background not printing | Default browser setting | Always set `print_background=True` |
| Pages have white margins | Default PDF margins | Set all margins to `"0"` |

---

## File Paths Used in Relationship PIP Project
- HTML source: `Ash/FA_DA_Connection_Code.html`
- PDF output:  `Ash/Relationship_PIP.pdf`
- Page size:   816 × 1056px (US Letter @ 96dpi)
- Final result: 8 pages, every section exactly 1056px ✓
