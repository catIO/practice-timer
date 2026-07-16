import textwrap
from pathlib import Path

# Simple PDF writer (no external deps)

PAGE_WIDTH = 612
PAGE_HEIGHT = 792
MARGIN_X = 54
MARGIN_TOP = 54
MARGIN_BOTTOM = 54
CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN_X

TITLE_SIZE = 18
HEADING_SIZE = 12
BODY_SIZE = 11
LEADING = 14

# Approximate max chars per line for body text in Helvetica 11pt within CONTENT_WIDTH
MAX_CHARS_BODY = 90
MAX_CHARS_BODY_INDENT = 86


def wrap(text, width):
    return textwrap.wrap(text, width=width, break_long_words=False, break_on_hyphens=False)


def escape_pdf_text(text: str) -> str:
    return text.replace('\\', r'\\').replace('(', r'\(').replace(')', r'\)')


def add_text(lines, text, x, y, font, size):
    lines.append({
        "text": text,
        "x": x,
        "y": y,
        "font": font,
        "size": size,
    })


# Content
sections = []

# Title
sections.append({
    "type": "title",
    "text": "Practice Timer - App Summary"
})

# What it is
what_it_is = (
    "Practice Timer is a React/Vite web app for running practice sessions with "
    "Pomodoro-style work and break cycles, notifications, and PWA support. "
    "It focuses on reliable timing across desktop and mobile browsers, including iOS." 
)
sections.append({
    "type": "section",
    "title": "What it is",
    "body": wrap(what_it_is, MAX_CHARS_BODY)
})

# Who it's for
sections.append({
    "type": "section",
    "title": "Who it's for",
    "body": ["Not found in repo."]
})

# What it does
features = [
    "Pomodoro-style work and break timer with customizable durations",
    "Iteration tracking across multiple work/break cycles",
    "Sound alerts when sessions complete",
    "Browser notifications for completion events",
    "PWA install support with service worker caching",
    "iOS background optimizations (background timer and wake-lock strategies)",
    "Dark mode and responsive layout for desktop and mobile",
]
sections.append({
    "type": "bullets",
    "title": "What it does",
    "items": features
})

# How it works
how_it_works = [
    "UI: React app in `client/src` styled with Tailwind; entry point in `client/src/main.tsx`.",
    "State: Zustand store in `client/src/stores/timerStore.ts` holds timer state and settings.",
    "Timing: Web Worker in `client/src/workers/timerWorker.ts` drives ticks and completion messages.",
    "Background: Service worker `client/public/sw.js` caches assets and runs background sync/notifications; registered in `client/src/main.tsx`.",
    "Persistence: Settings stored in localStorage via `client/src/lib/localStorage.ts`.",
    "Data flow: UI -> Zustand store -> Web Worker -> store -> UI; store posts updates to service worker for background handling.",
]
sections.append({
    "type": "bullets",
    "title": "How it works",
    "items": how_it_works
})

# How to run
how_to_run = [
    "Install Node.js v16+ (prerequisite from README).",
    "Run `npm install` from the repo root.",
    "Run `npm run dev` to start the Vite dev server.",
]
sections.append({
    "type": "bullets",
    "title": "How to run",
    "items": how_to_run
})


# Layout
current_y = PAGE_HEIGHT - MARGIN_TOP
lines = []

# Title
add_text(lines, sections[0]["text"], MARGIN_X, current_y, "Helvetica-Bold", TITLE_SIZE)
current_y -= 22

for section in sections[1:]:
    # Heading
    add_text(lines, section["title"], MARGIN_X, current_y, "Helvetica-Bold", HEADING_SIZE)
    current_y -= 16

    if section["type"] == "section":
        for line in section["body"]:
            add_text(lines, line, MARGIN_X, current_y, "Helvetica", BODY_SIZE)
            current_y -= LEADING
        current_y -= 4
    elif section["type"] == "bullets":
        for item in section["items"]:
            wrapped = wrap(item, MAX_CHARS_BODY_INDENT)
            for i, line in enumerate(wrapped):
                prefix = "- " if i == 0 else "  "
                add_text(lines, prefix + line, MARGIN_X, current_y, "Helvetica", BODY_SIZE)
                current_y -= LEADING
        current_y -= 4

    # Stop if we would overflow
    if current_y < MARGIN_BOTTOM:
        break

# Build PDF content stream
content = []
for line in lines:
    text = escape_pdf_text(line["text"])
    content.append(
        "BT\n"
        f"/{line['font']} {line['size']} Tf\n"
        f"1 0 0 1 {line['x']} {line['y']} Tm\n"
        f"({text}) Tj\n"
        "ET\n"
    )

content_stream = "".join(content).encode("latin-1", "replace")

# PDF objects
objects = []

# 1: Catalog
objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")

# 2: Pages
objects.append(b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")

# 3: Page
objects.append(
    b"3 0 obj\n"
    + f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] ".encode("ascii")
    + b"/Resources << /Font << /Helvetica 4 0 R /Helvetica-Bold 5 0 R >> >> "
    + b"/Contents 6 0 R >>\nendobj\n"
)

# 4: Helvetica
objects.append(b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")

# 5: Helvetica-Bold
objects.append(b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n")

# 6: Contents
objects.append(
    b"6 0 obj\n"
    + f"<< /Length {len(content_stream)} >>\nstream\n".encode("ascii")
    + content_stream
    + b"endstream\nendobj\n"
)

# Build xref
xref_positions = []
output = [b"%PDF-1.4\n"]
for obj in objects:
    xref_positions.append(sum(len(part) for part in output))
    output.append(obj)

xref_start = sum(len(part) for part in output)

xref = [b"xref\n", f"0 {len(objects)+1}\n".encode("ascii"), b"0000000000 65535 f \n"]
for pos in xref_positions:
    xref.append(f"{pos:010d} 00000 n \n".encode("ascii"))

trailer = (
    b"trailer\n"
    + f"<< /Size {len(objects)+1} /Root 1 0 R >>\n".encode("ascii")
    + b"startxref\n"
    + f"{xref_start}\n".encode("ascii")
    + b"%%EOF\n"
)

pdf_bytes = b"".join(output) + b"".join(xref) + trailer

out_path = Path("output/pdf/practice-timer-summary.pdf")
out_path.write_bytes(pdf_bytes)
print(out_path)
