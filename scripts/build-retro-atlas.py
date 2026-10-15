#!/usr/bin/env python3
"""Rebuild the complete ICQ Retro SVG, its matching PNG and skin manifest.

Optional artwork tool: Pillow, libpotrace and Inkscape. Ordinary game builds
use the shipped assets and do not need these programs. Original art, source
coordinates and editable referee drawings live in public/skins/icq-retro/source.
"""

from __future__ import annotations

import argparse
import colorsys
from copy import deepcopy
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET

try:
    from PIL import Image, ImageDraw, ImageFilter, ImageStat
    from retro_vectorize import trace_mask, trace_rgba
except (ImportError, RuntimeError) as exc:
    raise SystemExit(f'Optionales Grafikwerkzeug fehlt: {exc}. Siehe GRAFIKSETS.md.') from exc


SVG = 'http://www.w3.org/2000/svg'
ET.register_namespace('', SVG)
XLINK = 'http://www.w3.org/1999/xlink'
ET.register_namespace('xlink', XLINK)
ROOT = Path(__file__).resolve().parent.parent
DIRECTORY = ROOT / 'public/skins/icq-retro'
SOURCE = ROOT / 'public/skins/icq-retro/source'
KINDS = ['rock', 'paper', 'scissors', 'flag', 'trap', 'unknown']
WEAPONS = [f'weapon-{kind}' for kind in KINDS[:3]]
BASE_REFEREES = ['referee-blue-turn', 'referee-red-turn', 'referee-neutral']
DIRECTIONAL_REFEREES = ['referee-blue-top', 'referee-red-bottom']
REFEREES = [*BASE_REFEREES, *DIRECTIONAL_REFEREES]
FLAG_VICTORIES = ['blue-front-flag-victory', 'red-front-flag-victory']
PITCH, CONTENT, COLUMNS, ROWS = 288, 272, 7, 7
LEGACY_COLUMNS = 6
WIDTH, HEIGHT = PITCH * COLUMNS, PITCH * ROWS


def element(tag: str, **attributes: object) -> ET.Element:
    result = ET.Element(f'{{{SVG}}}{tag}', {
        key.replace('_', '-'): str(value) for key, value in attributes.items()
    })
    # Current browsers use href; Inkscape 1.2 and older SVG renderers need xlink.
    if tag == 'use' and 'href' in attributes:
        result.set(f'{{{XLINK}}}href', str(attributes['href']))
    return result


def tag_name(node: ET.Element) -> str:
    return node.tag.rsplit('}', 1)[-1]


def fragment(markup: str) -> ET.Element:
    return ET.fromstring(f'<svg xmlns="{SVG}">{markup}</svg>')


def traced_artwork(tile: Image.Image, name: str) -> ET.Element:
    output = element('g')
    output.extend(fragment(trace_rgba(tile, id_prefix=name)))
    return output


def team_fill(value: str, source: str, target: str, kind: str) -> str:
    """Recolor uniforms while retaining neutral tools, skin and black outlines.

    Traps keep their original yellow/gold surfaces for both teams; only their
    viewing direction differs. Flag bodies follow their owner; piece_templates
    applies the opposing color only inside the separate cloth clip. Hue
    selection occurs once at build time, never on hidden gameplay data.
    """
    if kind == 'trap':
        return value
    if not re.fullmatch(r'#[0-9a-fA-F]{6}', value):
        return value
    rgb = tuple(int(value[i:i + 2], 16) / 255 for i in (1, 3, 5))
    hue, saturation, light = colorsys.rgb_to_hsv(*rgb)
    blue = .52 <= hue <= .75 and saturation > .3
    red = (hue < .055 or hue > .94) and saturation > .55
    uniform = blue if source == 'blue' else red
    flag = kind == 'flag' and red
    if not (uniform or flag):
        return value
    if source == target and uniform and not (flag and target == 'blue'):
        return value
    target_hue = .615 if target == 'blue' else .995
    channels = colorsys.hsv_to_rgb(target_hue, saturation, light)
    return '#' + ''.join(f'{round(channel * 255):02x}' for channel in channels)


def flag_cloth(tile: Image.Image, source_name: str, definitions: ET.Element) -> tuple[str, str]:
    """Separate the original red cloth from same-colored uniforms and the pole."""
    mask = Image.new('L', tile.size)
    for y in range(tile.height):
        for x in range(tile.width):
            red, green, blue, alpha = tile.getpixel((x, y))
            hue, saturation, _ = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
            if alpha >= 128 and (hue < .055 or hue > .94) and saturation > .55:
                mask.putpixel((x, y), 255)
    # Fixed points lie inside the two cloth areas in the original source layout.
    seed = {'own-flag': (160, 193), 'enemy-flag': (211, 171)}[source_name]
    if mask.getpixel(seed) != 255:
        raise ValueError(f'Das Flaggentuch ist an seinem Quellpunkt nicht erkennbar: {source_name}')
    ImageDraw.floodfill(mask, seed, 128)
    cloth = mask.point(lambda value: 255 if value == 128 else 0).filter(ImageFilter.MaxFilter(9))
    # Extending into the unchanged black outline keeps the color split hidden.
    outline = trace_mask(cloth, turdsize=2)
    cloth_id, body_id = f'clip-flag-cloth-{source_name}', f'clip-flag-body-{source_name}'
    for identifier, drawing in [
        (cloth_id, outline),
        (body_id, f'M0 0H{tile.width}V{tile.height}H0Z ' + outline),
    ]:
        clipping = element('clipPath', id=identifier, clipPathUnits='userSpaceOnUse')
        clipping.append(element('path', d=drawing, fill_rule='evenodd', clip_rule='evenodd'))
        definitions.append(clipping)
    return cloth_id, body_id


def piece_templates(tile: Image.Image, source_name: str, definitions: ET.Element) -> dict[str, str]:
    """Two color variants share every Bezier path; only their fills differ."""
    source_color = 'blue' if source_name.startswith('own-') else 'red'
    direction = 'back' if source_color == 'blue' else 'front'
    suffix = source_name.split('-', 1)[1]
    kind = suffix.split('-', 1)[0]
    flag_clips = flag_cloth(tile, source_name, definitions) if kind == 'flag' else None
    traced = fragment(trace_rgba(tile, id_prefix=f'source-{source_name}'))
    layers = next(child for child in traced if tag_name(child) == 'g')
    for child in traced:
        if tag_name(child) == 'defs':
            definitions.extend(child)
    paths = []
    for index, path in enumerate(layers):
        identifier = f'geometry-{source_name}-{index}'
        geometry = deepcopy(path)
        color = geometry.attrib.pop('fill', '#080808')
        geometry.set('id', identifier)
        definitions.append(geometry)
        paths.append((identifier, color))
    names = {}
    for color in ['blue', 'red']:
        name = f'{color}-{direction}-{suffix}'
        template = element('g', id=f'template-{name}', **layers.attrib)
        for identifier, fill in paths:
            body_fill = team_fill(fill, source_color, color, kind)
            cloth_fill = team_fill(fill, source_color, 'red' if color == 'blue' else 'blue', kind)
            if flag_clips and cloth_fill != body_fill:
                cloth_id, body_id = flag_clips
                template.append(element('use', href=f'#{identifier}', fill=body_fill, clip_path=f'url(#{body_id})'))
                template.append(element('use', href=f'#{identifier}', fill=cloth_fill, clip_path=f'url(#{cloth_id})'))
            else:
                template.append(element('use', href=f'#{identifier}', fill=body_fill))
        definitions.append(template)
        names[color] = name
    return names


def vector_tile(name: str, tile: Image.Image, definitions: ET.Element) -> ET.Element:
    """Measured tile lighting becomes a continuous gradient without grain."""
    width, height = tile.size
    gradient = element('linearGradient', id=f'{name}-fill', x1='0', y1='0', x2='1', y2='0')
    for index in range(5):
        middle = round(index * (width - 1) / 4)
        sample = tile.crop((max(0, middle - 8), 0, min(width, middle + 9), height))
        average = ImageStat.Stat(sample).mean
        color = '#' + ''.join(f'{round(value):02x}' for value in average[:3])
        gradient.append(element('stop', offset=index / 4, stop_color=color, stop_opacity=f'{average[3] / 255:.4f}'))
    definitions.append(gradient)
    return element('rect', width=width, height=height, fill=f'url(#{name}-fill)')


def vector_weapons(definitions: ET.Element) -> dict[str, ET.Element]:
    source = ET.parse(DIRECTORY / 'weapon-atlas.svg').getroot()
    for child in source:
        if tag_name(child) == 'defs':
            definitions.extend(deepcopy(child))
    groups = {}
    for index, name in enumerate(WEAPONS):
        original = next((item for item in source if item.get('id') == name), None)
        if original is None:
            raise ValueError(f'Die Vektorquelle enthält {name} nicht.')
        artwork = deepcopy(original)
        artwork.attrib.pop('id', None)
        group = element('g', transform=f'translate({-index * 320} 0)')
        group.append(artwork)
        groups[name] = group
    return groups


def vector_referees(definitions: ET.Element) -> dict[str, ET.Element]:
    source = ET.parse(SOURCE / 'referees.svg').getroot()
    for child in source:
        if tag_name(child) == 'defs':
            definitions.extend(deepcopy(child))
    groups = {}
    for name in REFEREES:
        original = next((item for item in source.iter() if item.get('id') == name), None)
        if original is None:
            raise ValueError(f'Die Schiri-Vorlage enthält {name} nicht.')
        artwork = deepcopy(original)
        artwork.attrib.pop('id', None)
        groups[name] = artwork
    return groups


def vector_flag_victories(definitions: ET.Element) -> dict[str, ET.Element]:
    source = ET.parse(SOURCE / 'flag-victory.svg').getroot()
    for child in source:
        if tag_name(child) == 'defs':
            definitions.extend(deepcopy(child))
    groups = {}
    for name in FLAG_VICTORIES:
        original = next((item for item in source.iter() if item.get('id') == name), None)
        if original is None:
            raise ValueError(f'Die Sieger-Vorlage enthält {name} nicht.')
        artwork = deepcopy(original)
        artwork.attrib.pop('id', None)
        groups[name] = artwork
    return groups


def vector_logo(tile: Image.Image, definitions: ET.Element) -> ET.Element:
    """Original letter outlines with a real, continuous SVG gradient."""
    width, height = tile.size
    alpha = tile.getchannel('A').point(lambda value: 255 if value >= 128 else 0)
    output = element('g')
    output.append(element('path', d=trace_mask(alpha, turdsize=2), fill='#080907'))
    output.append(traced_artwork(tile.crop((0, 0, width, 94)), 'logo-head'))
    letters, subtitle = Image.new('L', tile.size), Image.new('L', tile.size)
    pixels = tile.load()
    for y in range(height):
        for x in range(width):
            red, green, blue, opacity = pixels[x, y]
            if opacity < 128:
                continue
            bright = min(red, green, blue) > 130 and max(red, green, blue) - min(red, green, blue) < 40
            lime = green > red * 1.04 and green > blue * 1.15
            if 84 <= y < 188 and green > 100 and (bright or lime):
                letters.putpixel((x, y), 255)
            if y >= 190 and bright:
                subtitle.putpixel((x, y), 255)
    # Close isolated one-pixel pits without closing the letters' real counters.
    letters = letters.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    subtitle = subtitle.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    gradient = element('linearGradient', id='logo-letter-fill', x1='0', y1='90', x2='0', y2='180', gradientUnits='userSpaceOnUse')
    for y, color in [(90, '#b6ea02'), (100, '#b5e802'), (110, '#b4e603'), (120, '#b6e50a'),
                     (130, '#bbe133'), (140, '#c8e46a'), (150, '#daeda4'), (155, '#e3f0be'),
                     (160, '#edf4d7'), (170, '#fdfdfc'), (180, '#f9f9f9')]:
        gradient.append(element('stop', offset=f'{(y - 90) / 90:.4f}', stop_color=color))
    definitions.append(gradient)
    output.append(element('path', d=trace_mask(letters, turdsize=4), fill='url(#logo-letter-fill)'))
    output.append(element('path', d=trace_mask(subtitle, turdsize=4), fill='#fbfbf8'))
    return output


def validate(root: ET.Element) -> None:
    identifiers = [node.get('id') for node in root.iter() if node.get('id')]
    if len(identifiers) != len(set(identifiers)):
        raise ValueError('Der Atlas enthält doppelte SVG-IDs.')
    known = set(identifiers)
    for node in root.iter():
        if tag_name(node) in {'image', 'script', 'foreignObject', 'text', 'filter'}:
            raise ValueError(f'Kein eigenständiger Vektorinhalt: {tag_name(node)}')
        for key, value in node.attrib.items():
            if key.endswith('href') and (not value.startswith('#') or value[1:] not in known):
                raise ValueError(f'Unbekannte oder externe SVG-Abhängigkeit: {value}')
            if re.search(r'url\((?!#)', value):
                raise ValueError('Der Atlas darf nur lokale SVG-Definitionen verwenden.')


def atomic_write(path: Path, data: bytes) -> None:
    """Publish a complete, flushed asset rather than exposing a partial export."""
    descriptor, temporary_name = tempfile.mkstemp(prefix=path.name + '.', suffix='.tmp', dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, 'wb') as output:
            os.fchmod(output.fileno(), 0o644)
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        temporary.unlink(missing_ok=True)


def build(destination: Path) -> dict[str, object]:
    inkscape = shutil.which('inkscape')
    if not inkscape:
        raise SystemExit('PNG-Export benötigt Inkscape. Siehe GRAFIKSETS.md.')
    manifest = json.loads((DIRECTORY / 'skin.json').read_text())
    source_layout = json.loads((SOURCE / 'layout.json').read_text())
    original = Image.open(SOURCE / 'original.png').convert('RGBA')
    if original.size != (source_layout['width'], source_layout['height']):
        raise ValueError('Maße der Originalvorlage und Ausschnittplan stimmen nicht überein.')

    def crop(name: str) -> Image.Image:
        frame = source_layout['frames'][name]
        x, y, w, h = (frame[key] for key in ['x', 'y', 'width', 'height'])
        return original.crop((x, y, x + w, y + h))

    root = element('svg', width=WIDTH, height=HEIGHT, viewBox=f'0 0 {WIDTH} {HEIGHT}')
    title, description = element('title'), element('desc')
    title.text = 'ICQ Retro – vollständiger Vektoratlas'
    description.text = ('43 Vektormotive: blaue und rote Figuren in beiden Blickrichtungen, gelbe Fallen, '
                        'Aufdeckposen, Brettkacheln, Logo, vier Schiedsrichter-Richtungsposen, eine neutrale Pose, Einzelwaffen '
                        'und zwei frontale Flaggeneroberer mit dem tatsächlich eroberten Tuch. '
                        'Spieler 1 ist blau, Spieler 2 rot. Keine eingebetteten Rasterbilder oder Schriftdateien.')
    root.extend([title, description])
    definitions = element('defs')
    root.append(definitions)
    artwork, sizes = {}, {}
    sources = [f'{team}-{kind}' for team in ['own', 'enemy'] for kind in KINDS]
    sources += [f'own-{kind}-revealed' for kind in KINDS[:3]]
    for name in sources:
        tile = crop(name)
        for frame_name in piece_templates(tile, name, definitions).values():
            artwork[frame_name] = element('use', href=f'#template-{frame_name}')
            sizes[frame_name] = tile.size
        print(f'Vektorisiert: {name}', flush=True)
    for name in ['board-light', 'board-dark']:
        tile = crop(name)
        artwork[name], sizes[name] = vector_tile(name, tile, definitions), tile.size
    tile = crop('logo')
    artwork['logo'], sizes['logo'] = vector_logo(tile, definitions), tile.size
    artwork.update(vector_referees(definitions))
    sizes.update({name: (320, 240) for name in REFEREES})
    artwork.update(vector_weapons(definitions))
    sizes.update({name: (320, 320) for name in WEAPONS})
    artwork.update(vector_flag_victories(definitions))
    sizes.update({name: (320, 320) for name in FLAG_VICTORIES})

    order = [f'{color}-{direction}-{kind}' for color in ['blue', 'red']
             for direction in ['back', 'front'] for kind in KINDS]
    order += [f'{color}-back-{kind}-revealed' for color in ['blue', 'red'] for kind in KINDS[:3]]
    # New motifs stay after the original 41; legacy frame coordinates never move.
    order += ['board-light', 'board-dark', 'logo', *BASE_REFEREES, *WEAPONS, *DIRECTIONAL_REFEREES]
    order += FLAG_VICTORIES
    if len(order) != 43 or len(artwork) != len(order):
        raise ValueError('Der vollständige Satz muss 43 Motive enthalten.')
    frames = {}
    for index, name in enumerate(order):
        w, h = sizes[name]
        scale = CONTENT / max(w, h)
        fw, fh = round(w * scale), round(h * scale)
        # Fill the last old slot, then the new right column. Keeping the atlas
        # square also preserves 2x rendering within a 4096-pixel texture limit.
        legacy_slots = LEGACY_COLUMNS * ROWS
        column, row = (index % LEGACY_COLUMNS, index // LEGACY_COLUMNS) if index < legacy_slots else (LEGACY_COLUMNS, index - legacy_slots)
        x = column * PITCH + (PITCH - fw) // 2
        y = row * PITCH + (PITCH - fh) // 2
        frames[name] = dict(x=x, y=y, width=fw, height=fh)
        clipping = element('clipPath', id=f'clip-frame-{name}', clipPathUnits='userSpaceOnUse')
        clipping.append(element('rect', width=fw, height=fh))
        definitions.append(clipping)
        group = element('g', id=name, transform=f'translate({x} {y})', clip_path=f'url(#clip-frame-{name})')
        scaled = element('g', transform=f'scale({fw / w:.8f} {fh / h:.8f})')
        scaled.append(artwork[name])
        group.append(scaled)
        root.append(group)

    def pieces(color: str, direction: str) -> dict[str, object]:
        result = {}
        for kind in KINDS:
            item = {'frame': f'{color}-{direction}-{kind}'}
            if direction == 'back' and kind in KINDS[:3]:
                item['revealed'] = {'frame': f'{color}-back-{kind}-revealed'}
            result[kind] = item
        return result

    manifest['atlas'] = dict(image='atlas.svg', fallbackImage='atlas.png', frames=frames)
    manifest['teamPieces'] = {
        color: {'own': pieces(color, 'back'), 'enemy': pieces(color, 'front')}
        for color in ['blue', 'red']
    }
    # Kept as a compatible default for older skin editors; current clients use teamPieces.
    manifest['pieces'] = {'own': pieces('blue', 'back'), 'enemy': pieces('red', 'front')}
    manifest['portrait'] = 'referee-neutral'
    manifest['colorTurnPortraits'] = {'blue': 'referee-blue-turn', 'red': 'referee-red-turn'}
    manifest['turnPortraits'] = {'own': 'referee-blue-turn', 'enemy': 'referee-red-turn'}
    manifest['directionalTurnPortraits'] = {
        'blue': {'top': 'referee-blue-top', 'bottom': 'referee-blue-turn'},
        'red': {'top': 'referee-red-turn', 'bottom': 'referee-red-bottom'},
    }
    manifest['weapons'] = {kind: f'weapon-{kind}' for kind in KINDS[:3]}
    manifest['flagVictoryFrames'] = {'blue': FLAG_VICTORIES[0], 'red': FLAG_VICTORIES[1]}
    manifest.pop('weaponAtlas', None)
    validate(root)
    ET.indent(root, space='  ')
    result = ET.tostring(root, encoding='utf-8', xml_declaration=True) + b'\n'
    destination.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='rps-retro-') as temporary:
        svg, png = Path(temporary) / 'atlas.svg', Path(temporary) / 'atlas.png'
        svg.write_bytes(result)
        process = subprocess.run([inkscape, str(svg), '--export-type=png', f'--export-filename={png}',
                                  '--export-area-page', f'--export-width={WIDTH}', f'--export-height={HEIGHT}'],
                                 capture_output=True, text=True, timeout=180)
        if process.returncode or not png.exists():
            raise RuntimeError(f'PNG-Export fehlgeschlagen: {process.stderr[-1500:]}')
        rendered = Image.open(png).convert('RGBA')
        if rendered.size != (WIDTH, HEIGHT):
            raise ValueError('PNG und SVG müssen dieselben Maße haben.')
        for name, frame in frames.items():
            x, y, w, h = (frame[key] for key in ['x', 'y', 'width', 'height'])
            if not rendered.crop((x, y, x + w, y + h)).getchannel('A').getbbox():
                raise ValueError(f'Der PNG-Export enthält ein leeres Motiv: {name}')
        png_buffer = io.BytesIO()
        rendered.save(png_buffer, format='PNG', optimize=True)
        png_result = png_buffer.getvalue()
        if not png_result.endswith(bytes.fromhex('0000000049454e44ae426082')):
            raise ValueError('Der PNG-Export ist unvollständig.')
        Image.open(io.BytesIO(png_result)).load()
        atomic_write(destination / 'atlas.svg', result)
        atomic_write(destination / 'atlas.png', png_result)
        atomic_write(destination / 'skin.json', (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))
    return {
        'file': str(destination / 'atlas.svg'), 'width': WIDTH, 'height': HEIGHT,
        'frames': len(frames), 'paths': sum(tag_name(node) == 'path' for node in root.iter()),
        'bytes': len(result), 'gzip_bytes': len(gzip.compress(result)),
        'png_bytes': (destination / 'atlas.png').stat().st_size,
        'png_sha256': hashlib.sha256((destination / 'atlas.png').read_bytes()).hexdigest(),
        'team_colors': ['blue', 'red'], 'png_rendered_from_svg': True,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=DIRECTORY)
    arguments = parser.parse_args()
    print(json.dumps(build(arguments.output_dir), ensure_ascii=False, indent=2))
