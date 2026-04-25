#!/usr/bin/env python3
"""Génère des vignettes pour les images trouvées dans les dossiers racines
et met à jour les pages HTML correspondantes dans le dossier `site/`.

Usage:
  cd d:/dev/siteAlex/site
  python generate_galleries.py
"""
from pathlib import Path
import shutil
import re
from urllib.parse import quote
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]  # d:/dev/siteAlex
SITE = Path(__file__).resolve().parent
ASSETS_DIR = SITE / 'assets'
IMG_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.bmp'}

def slugify(name: str) -> str:
    s = name.lower()
    s = re.sub(r"[ _]+", '-', s)
    s = re.sub(r"[^a-z0-9\-àâçéèêëîïôûùüÿñæœ]+", '-', s)
    s = re.sub(r"-+", '-', s)
    s = s.strip('-')
    return s

def collect_images(src_dir: Path):
    files = []
    for p in src_dir.rglob('*'):
        if p.is_file() and p.suffix.lower() in IMG_EXTS:
            files.append(p)
    return sorted(files)

def ensure_dirs(p: Path):
    p.mkdir(parents=True, exist_ok=True)

def make_thumbnail(src: Path, dst: Path, max_size=(400,400)):
    try:
        im = Image.open(src)
        # Apply EXIF orientation so thumbnail has correct rotation
        im = ImageOps.exif_transpose(im)
        im.thumbnail(max_size)
        if im.mode in ("RGBA", "LA"):
            bg = Image.new("RGB", im.size, (255,255,255))
            bg.paste(im, mask=im.split()[3])
            im = bg
        else:
            im = im.convert('RGB')
        im.save(dst, quality=85)
    except Exception as e:
        print(f"Erreur vignette {src}: {e}")

def update_html(page: Path, slug: str, images):
    html = page.read_text(encoding='utf-8')
    gallery_items = []

    # Compute sizes from originals to detect very wide images server-side
    sizes = []
    for name in images:
        fpath = ASSETS_DIR / slug / 'original' / name
        try:
            with Image.open(fpath) as im:
                w, h = im.size
        except Exception:
            w, h = 0, 0
        sizes.append((name, w, h))

    widths = sorted([w for _, w, h in sizes if w > 0])
    ratios = sorted([ (w/h) for _, w, h in sizes if w>0 and h>0 ])
    medianW = 0
    medianR = 0
    if widths:
        mid = len(widths)//2
        medianW = widths[mid] if len(widths)%2==1 else (widths[mid-1]+widths[mid])/2
    if ratios:
        midr = len(ratios)//2
        medianR = ratios[midr] if len(ratios)%2==1 else (ratios[midr-1]+ratios[midr])/2

    WIDTH_THRESH = 1.4
    RATIO_THRESH = max(1.8, medianR * 1.5 if medianR>0 else 1.8)

    for name, w, h in sizes:
        orig = f"assets/{slug}/original/{name}"
        thumb = f"assets/{slug}/thumbs/{name}"
        viewer = f"viewer.html?img={quote(orig)}"
        cls = ''
        try:
            ratio = (w/h) if (w and h) else 0
        except Exception:
            ratio = 0
        if (medianW and w > medianW * WIDTH_THRESH) or (ratio and ratio > RATIO_THRESH):
            cls = ' class="gallery-large"'
        gallery_items.append(f'<a{cls} href="{viewer}"><img src="{thumb}" alt=""></a>')

    gallery_html = '\n'.join(gallery_items) if gallery_items else '<div class="card">Aucune image trouvée.</div>'

    new_html, n = re.subn(r'(<section[^>]*class=["\']gallery["\'][^>]*>).*?(</section>)',
                        r"\1\n" + gallery_html + r"\n\2",
                        html, flags=re.S)
    if n:
        page.write_text(new_html, encoding='utf-8')
        print(f'Page mise à jour: {page.name} ({len(images)} images)')
    else:
        print(f'Balise <section class="gallery"> introuvable dans {page.name}, saut.')

def main():
    ASSETS_DIR.mkdir(exist_ok=True)
    entries = [p for p in ROOT.iterdir() if p.is_dir() and p.name.lower() != 'site' and not p.name.startswith('.') and p.name.lower() not in ('venv', '.venv', 'env')]
    index_map = []  # list of tuples (slug, display_name, first_thumb_name_or_None)
    for d in sorted(entries):
        slug = slugify(d.name)
        imgs = collect_images(d)
        if not imgs:
            print(f'Aucune image dans {d.name}, saut.')
            index_map.append((slug, d.name, None))
            continue

        out_original = ASSETS_DIR / slug / 'original'
        out_thumbs = ASSETS_DIR / slug / 'thumbs'
        ensure_dirs(out_original)
        ensure_dirs(out_thumbs)

        copied = []
        for img in imgs:
            name = img.name
            dst_orig = out_original / name
            dst_thumb = out_thumbs / name
            # Open and re-save original with EXIF orientation applied so browsers show correct rotation
            try:
                im = Image.open(img)
                im = ImageOps.exif_transpose(im)
                # Preserve alpha if present, otherwise convert to RGB
                if im.mode in ("RGBA", "LA"):
                    bg = Image.new("RGBA", im.size)
                    bg.paste(im, (0,0), im.split()[3])
                    im = bg
                    im.save(dst_orig)
                else:
                    im = im.convert('RGB')
                    im.save(dst_orig, quality=95)
            except Exception:
                # fallback to raw copy
                try:
                    shutil.copy2(img, dst_orig)
                except Exception as e:
                    print(f'Erreur copie {img}: {e}')
                    continue
            # create thumbnail from the corrected original
            make_thumbnail(dst_orig, dst_thumb, max_size=(420,420))
            copied.append(name)

        # remember first thumbnail for index
        first_thumb = copied[0] if copied else None
        index_map.append((slug, d.name, first_thumb))

        page_file = SITE / f"{slug}.html"
        if page_file.exists():
            update_html(page_file, slug, copied)
        else:
            print(f'Page HTML introuvable pour {slug}: attendu {page_file.name}')

    print('\nTerminé. Ouvrez site/index.html dans votre navigateur.')

    # Update index.html gallery with representative thumbnails per page
    idx_file = SITE / 'index.html'
    if idx_file.exists():
        idx_html = idx_file.read_text(encoding='utf-8')

        # Build navigation HTML from index_map (keeps order)
        nav_items = []
        for slug, display, _ in index_map:
            nav_items.append(f'<a href="{slug}.html">{display}</a>')
        nav_html = '\n'.join(nav_items)

        # Replace nav block
        new_idx, n_nav = re.subn(r'(<nav[^>]*class=["\']nav["\'][^>]*>).*?(</nav>)',
                                 r"\1\n" + nav_html + r"\n\2",
                                 idx_html, flags=re.S)

        # Build gallery cards
        cards = []
        for slug, display, thumb in index_map:
            page_href = f"{slug}.html"
            if thumb:
                thumb_src = f"assets/{slug}/thumbs/{thumb}"
                card = (f'<div class="card card-thumb">'
                        f'<a href="{page_href}"><img src="{thumb_src}" alt="{display}"></a>'
                        f'<a class="card-title" href="{page_href}">{display}</a>'
                        f'</div>')
            else:
                card = f'<div class="card"><div class="card-title">{display}</div></div>'
            cards.append(card)
        gallery_html = '\n'.join(cards) if cards else '<div class="card">Aucune page.</div>'

        # Replace gallery section in the nav-replaced HTML
        final_idx, n_gallery = re.subn(r'(<section[^>]*class=["\']gallery["\'][^>]*>).*?(</section>)',
                                       r"\1\n" + gallery_html + r"\n\2",
                                       new_idx, flags=re.S)

        if n_nav or n_gallery:
            idx_file.write_text(final_idx, encoding='utf-8')
            print('Index mis à jour (navigation + miniatures).')
        else:
            print('Balises <nav class="nav"> ou <section class="gallery"> introuvables dans index.html, saut.')

    # Convert existing direct-original links in all pages to viewer links
    def replace_match(m):
        orig = m.group(1)
        return f'href="viewer.html?img={quote(orig)}"'

    for html_file in SITE.glob('*.html'):
        if html_file.name == 'viewer.html':
            continue
        text = html_file.read_text(encoding='utf-8')
        new_text, count = re.subn(r'href=["\'](assets/[^"\']+/original/[^"\']+)["\']', replace_match, text)
        if count:
            html_file.write_text(new_text, encoding='utf-8')
            print(f'Mis à jour des liens image dans {html_file.name} ({count} substitutions)')

if __name__ == '__main__':
    main()
