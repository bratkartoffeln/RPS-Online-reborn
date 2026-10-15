"""Derive combat source SVGs from each pack's own silhouettes and visual language.

Python standard library only. Follow with build-combat-atlases.mjs to export
matching desktop, fallback and mobile atlases. Existing artwork is untouched.
"""
from copy import deepcopy
from pathlib import Path
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SVG = 'http://www.w3.org/2000/svg'
ET.register_namespace('', SVG)
NAMES = ['combat-trap-hole', 'combat-flag-blue',
         'combat-flag-red', 'combat-puff', 'combat-figure-blue', 'combat-figure-red']


def element(tag, **attrs):
    return ET.Element(f'{{{SVG}}}{tag}', {k.replace('_', '-'): str(v) for k, v in attrs.items()})


def markup(text):
    return ET.fromstring(f'<g xmlns="{SVG}">{text}</g>')


def expanded(node, lookup):
    """Inline local geometry references, retaining the original contour and fills."""
    if node.tag.rsplit('}', 1)[-1] == 'use':
        target = lookup[node.get('href', node.get('{http://www.w3.org/1999/xlink}href'))[1:]]
        result = expanded(target, lookup)
        result.attrib.update({k: v for k, v in node.attrib.items() if k not in ['href', f'{{http://www.w3.org/1999/xlink}}href', 'clip-path']})
    else:
        result = element(node.tag.rsplit('}', 1)[-1])
        result.attrib.update({k: v for k, v in node.attrib.items() if k not in ['id', 'clip-path']})
        for child in node:
            result.append(expanded(child, lookup))
    result.attrib.pop('id', None)
    result.attrib.pop('clip-path', None)
    return result


def original_figure(id, color):
    directory = ROOT / 'public/skins' / id
    manifest = json.loads((directory / 'skin.json').read_text(encoding='utf8'))
    root = ET.parse(directory / manifest['atlas']['image']).getroot()
    lookup = {n.get('id'): n for n in root.iter() if n.get('id')}
    name = f'{color}-front-unknown' if id.startswith('icq') else f'{"own" if color == "blue" else "enemy"}-unknown-idle-0'
    frame = manifest['atlas']['frames'][name]
    source = expanded(lookup[name], lookup)
    source.attrib.pop('transform', None)
    group = element('g', transform=f'scale({128 / frame["width"]} {128 / frame["height"]})')
    group.append(source)
    return group


def retro_flag(owner):
    root = ET.parse(ROOT / 'public/skins/icq-retro/source/flag-victory.svg').getroot()
    # A holder's target cloth is the opposing color. Reuse the finished capture
    # cloth, its folds, highlights, outline and wooden pole from the source art.
    color = 'red' if owner == 'blue' else 'blue'
    original = next(n for n in root.iter() if n.get('id') == f'{color}-front-flag-victory')
    group = element('g')
    defs = deepcopy(root.find(f'{{{SVG}}}defs'))
    group.append(defs)
    flag = element('g', transform='translate(-28 3) scale(.46)', stroke='#080908', stroke_width='7', stroke_linecap='round', stroke_linejoin='round')
    for node in list(original)[:6]:
        if node.tag.rsplit('}', 1)[-1] != 'ellipse':
            flag.append(deepcopy(node))
    group.append(flag)
    # Namespace source gradient IDs separately for the two cloth frames.
    text = ET.tostring(group, encoding='unicode')
    text = re.sub(r'hero-([\w-]+)', lambda m: f'combat-{owner}-hero-{m[1]}', text)
    return ET.fromstring(text)


def sources(id):
    if id.startswith('icq'):
        figures = [original_figure('icq-retro', color) for color in ['blue', 'red']]
        hole = markup('''<defs><linearGradient id="combat-earth" x2="0" y2="1"><stop stop-color="#d1aa60"/><stop offset=".42" stop-color="#8d663b"/><stop offset="1" stop-color="#4b3620"/></linearGradient><radialGradient id="combat-depth" cx=".53" cy=".15" r=".85"><stop stop-color="#3c2916"/><stop offset=".65" stop-color="#171108"/><stop offset="1" stop-color="#050604"/></radialGradient></defs><g stroke="#080908" stroke-linejoin="round"><path d="M7 92Q10 79 28 78L37 72 62 71 73 74 96 74 115 85 122 96 115 110 94 120 67 124 35 119 15 109Z" fill="url(#combat-earth)" stroke-width="3"/><ellipse cx="64" cy="96" rx="51" ry="20" fill="url(#combat-depth)" stroke-width="4"/><path d="M18 92Q39 78 71 81T110 92" fill="none" stroke="#f4d68c" stroke-width="2.5"/><path d="m15 104 5 4m15 6 5 1m51 0 9-3m14-11 3-3" stroke="#b18a4e" stroke-width="2"/><path d="M24 98Q65 83 105 99" fill="none" stroke="#5a3e20" stroke-width="2"/></g>''')
        puff = markup('''<defs><radialGradient id="combat-smoke" cx=".35" cy=".25" r=".85"><stop stop-color="#fffde9"/><stop offset=".65" stop-color="#e9e8ce"/><stop offset="1" stop-color="#b9bda1"/></radialGradient></defs><g stroke="#15170e" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 91C0 88 2 65 15 59 4 40 19 25 37 31 37 8 67 6 76 23 96 7 118 25 111 43 131 46 133 73 115 82 127 104 106 120 88 111 77 130 51 123 47 109 30 119 15 107 19 91Z" fill="url(#combat-smoke)"/><path d="M16 59q16-8 22 5m0-33q15-4 19 7m19-15q0 16-9 18m44 2q-16 3-17 15m21 24q-17-7-23 7m-45 20q8-17-2-22m9-22q11-12 22-1t-1 22" fill="none" stroke="#929a7b" stroke-width="2"/><path d="M27 41q4-5 9-4m19-17q8-3 12 2m40 34q8 6 3 13" fill="none" stroke="#fffef0" stroke-width="3"/></g>''')
        return [hole, retro_flag('blue'), retro_flag('red'), puff, *figures]
    if id == 'arcade':
        figures = [original_figure(id, color) for color in ['blue', 'red']]
        hole = markup('''<g stroke-linejoin="round"><path d="m8 88 21-13h70l21 13v20l-21 14H29L8 108Z" fill="#09151e"/><path d="m9 88 21-12h68l21 12-21 22H30Z" fill="#ffcf7e"/><path d="m18 90 16-8h60l16 8-17 15H35Z" fill="#694b2b"/><path d="m22 91 14-5h56l14 5-15 11H37Z" fill="#101d25"/><path d="M30 79h68M28 113h72" stroke="#ffe5b3" stroke-width="1.5"/><path d="m12 108 17 11h70l16-11" fill="none" stroke="#8d602d" stroke-width="3"/></g>''')
        flags = [markup(f'''<g stroke="#111f27" stroke-width="3" stroke-linejoin="round"><path d="M44 119V13" stroke="#ffcf7e" stroke-width="5"/><path d="M47 16h65L94 36l18 23H47Z" fill="{base}"/><path d="M49 19h56L91 34H49Z" fill="{light}" stroke="none"/><path d="M32 120h25" stroke="#ffcf7e"/></g>''') for base, light in [('#db4e55', '#ffb5ad'), ('#337ddb', '#9bcaff')]]
        puff = markup('''<g stroke="#111f27" stroke-width="2" stroke-linejoin="round"><path d="m15 42 22 1 2-24 22 16L80 8l9 27 30-5-14 30 20 17-29 8 2 27-28-13-22 25-8-30-32 3 12-28L3 57Z" fill="#d4f57b"/><path d="m37 48 21 3 12-18 6 23 24 7-23 13-6 25-15-22-23 3 9-17Z" fill="#eef9ef" stroke="none"/><path d="m9 15 9 11m96 88 8 9M5 112l13-9m94-97-9 12" stroke="#ffcf7e" stroke-width="3"/></g>''')
        return [hole, *flags, puff, *figures]
    # Classic uses the existing icon system's 24-unit grid and thin round strokes.
    def classic(body, color='#b8c6c7'):
        return markup(f'<g transform="scale(5.333333)" fill="none" stroke="{color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">{body}</g>')
    figures = [classic('<circle cx="12" cy="6" r="3"/><path d="M7 21v-5l-3-2 3-4h10l3 4-3 2v5m-10-6h10m-5 1v5"/>', c) for c in ['#75a8ff', '#f48b83']]
    hole = classic('<ellipse cx="12" cy="19" rx="10" ry="4"/><path d="M4 19c3-3 13-3 16 0m-16 3 3 1m10 0 3-1"/>')
    flags = [classic('<path d="M7 22V3m0 1h13l-3 4 3 4H7M4 22h6"/>', c) for c in ['#f48b83', '#75a8ff']]
    puff = classic('<path d="M5 17c-5 0-5-7-1-8-2-5 4-8 7-4 3-5 9-2 8 2 5-1 6 7 2 8 2 5-4 8-7 5-3 4-9 2-9-3Z"/><path d="M4 9q3-1 4 2m3-6q2 2 1 4m7-2q-3 1-2 3m-3 10q1-3-1-4"/>')
    return [hole, *flags, puff, *figures]


directory = ROOT / 'public/skins'
directory.mkdir(parents=True, exist_ok=True)
for id in ['classic', 'arcade', 'icq-retro', 'icq-retro-dark']:
    root = element('svg', width='896', height='128', viewBox='0 0 896 128')
    ET.SubElement(root, f'{{{SVG}}}title').text = f'{id}: combat scenery derived from the original pack'
    for index, (name, drawing) in enumerate(zip(NAMES, sources(id))):
        group = element('g', id=name, transform=f'translate({index * 128} 0)')
        # Duplicate figures have unique IDs; all underlying geometry is inline.
        group.append(drawing)
        root.append(group)
    target = directory / id / 'source'
    target.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(root).write(target / 'combat.svg', encoding='utf-8', xml_declaration=False)
    print(f'{id}: source silhouettes and matching scenery exported')
