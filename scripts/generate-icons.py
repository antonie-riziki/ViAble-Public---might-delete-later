from pathlib import Path
from PIL import Image

out = Path('public/brand')
source = Image.open(out / 'logo.png').convert('RGBA')
for size in (16, 32, 48, 128):
    image = source.resize((size, size), Image.Resampling.LANCZOS)
    image.save(out / f'icon{size}.png')
