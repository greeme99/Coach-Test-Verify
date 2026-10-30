import sys, os, re
sys.stdout.reconfigure(encoding="utf-8")

def build_single_html():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    src_dir = os.path.join(base_dir, "src")
    scratch_dir = r"C:\Users\0208m\.gemini\antigravity\brain\2fb55675-15c3-46dd-9504-c42adaa7a5f6\scratch"
    xlsx_min_path = os.path.join(scratch_dir, "package", "dist", "xlsx.full.min.js")

    if not os.path.exists(xlsx_min_path):
        print(f"ERROR: {xlsx_min_path} does not exist!")
        return 1

    print("[1/5] Reading source files...")
    with open(os.path.join(src_dir, "template.html"), "r", encoding="utf-8") as f:
        html = f.read()

    with open(os.path.join(src_dir, "styles.css"), "r", encoding="utf-8") as f:
        css = f.read()

    with open(xlsx_min_path, "r", encoding="utf-8") as f:
        sheetjs = f.read()

    with open(os.path.join(src_dir, "icons.js"), "r", encoding="utf-8") as f:
        icons_js = f.read()

    with open(os.path.join(src_dir, "models.js"), "r", encoding="utf-8") as f:
        models_js = f.read()

    with open(os.path.join(src_dir, "parser.js"), "r", encoding="utf-8") as f:
        parser_js = f.read()

    with open(os.path.join(src_dir, "validator.js"), "r", encoding="utf-8") as f:
        validator_js = f.read()

    with open(os.path.join(src_dir, "app.js"), "r", encoding="utf-8") as f:
        app_js = f.read()

    print("[2/5] Replacing CSS and SheetJS...")
    html = html.replace("/* INLINE_CSS */", css)
    html = html.replace("/* INLINE_SHEETJS */", sheetjs)

    print("[3/5] Injecting inline SVG icons...")
    # Extract SVG strings from icons.js
    icon_map = {}
    for match in re.finditer(r'([a-zA-Z0-9]+):\s*`(<svg[\s\S]*?<\/svg>)`', icons_js):
        icon_map[match.group(1)] = match.group(2)

    html = html.replace("<!-- INLINE_LOGO_ICON -->", icon_map.get("logo", ""))
    html = html.replace("<!-- INLINE_SHIELD_ICON -->", icon_map.get("shieldCheck", ""))
    html = html.replace("<!-- INLINE_UPLOAD_ICON -->", icon_map.get("upload", ""))
    html = html.replace("<!-- INLINE_INFO_ICON -->", icon_map.get("info", ""))
    html = html.replace("<!-- INLINE_PRINTER_ICON -->", icon_map.get("printer", ""))
    html = html.replace("<!-- INLINE_COPY_ICON -->", icon_map.get("copy", ""))
    html = html.replace("<!-- INLINE_TRASH_ICON -->", icon_map.get("trash", ""))
    html = html.replace("<!-- INLINE_SAVE_ICON -->", icon_map.get("save", ""))
    html = html.replace("<!-- INLINE_ROTATE_ICON -->", icon_map.get("rotateCcw", ""))

    print("[4/5] Injecting JavaScript modules...")
    html = html.replace("/* INLINE_ICONS_JS */", icons_js)
    html = html.replace("/* INLINE_MODELS_JS */", models_js)
    html = html.replace("/* INLINE_PARSER_JS */", parser_js)
    html = html.replace("/* INLINE_VALIDATOR_JS */", validator_js)
    html = html.replace("/* INLINE_APP_JS */", app_js)

    output_path = os.path.join(base_dir, "index.html")
    print(f"[5/5] Writing final single-file HTML to {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"SUCCESS: index.html generated successfully! File size: {size_mb:.2f} MB")
    return 0

if __name__ == "__main__":
    sys.exit(build_single_html())

