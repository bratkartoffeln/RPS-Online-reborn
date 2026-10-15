"""Export editable native SVG endgame poses from the existing ICQ character sources."""
from copy import deepcopy
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
SVG = 'http://www.w3.org/2000/svg'
ET.register_namespace('', SVG)
ET.register_namespace('xlink', 'http://www.w3.org/1999/xlink')
source = ROOT / 'design/icq-retro-source'
output = ROOT / 'public/endgame'
output.mkdir(parents=True, exist_ok=True)
heroes = ET.parse(source / 'flag-victory.svg').getroot()
referees = ET.parse(source / 'referees.svg').getroot()


def path(d, fill='none', **attrs):
    return ET.Element(f'{{{SVG}}}path', {'d': d, 'fill': fill, **attrs})


def export(name, group, definitions, viewbox, title):
    root = ET.Element(f'{{{SVG}}}svg', {'viewBox': viewbox, 'width': viewbox.split()[2], 'height': viewbox.split()[3], 'role': 'img'})
    ET.SubElement(root, f'{{{SVG}}}title').text = title
    root.append(deepcopy(definitions))
    group.set('id', name)
    root.append(group)
    ET.indent(root, space='  ')
    ET.ElementTree(root).write(output / f'{name}.svg', encoding='utf-8', xml_declaration=True)


for color in ['blue', 'red']:
    original = next(node for node in heroes.iter() if node.get('id') == f'{color}-front-flag-victory')
    for mood in ['happy', 'sad', 'neutral']:
        group = deepcopy(original)
        # Cloth, poles and gripping hand belong to flag capture, not these outcome poses.
        for node in list(group):
            d = node.get('d', '')
            if d.startswith(('M220 26', 'M228 36', 'M270 19', 'M177 252', 'M185 153', 'M190 144')):
                group.remove(node)
        if mood == 'happy':
            group.append(path('M185 153C180 145 184 137 190 136L194 127Q200 123 204 129 211 125 216 131L215 143Q220 148 215 155L204 165Q188 166 185 153Z', 'url(#hero-skin)', **{'stroke-width': '6'}))
        else:
            # Drop the arms and replace the smiling facial expression.
            for node in list(group):
                d = node.get('d', '')
                if d.startswith(('M81 210', 'M42 218', 'M28 198', 'M149 213', 'M179 178', 'M67 177', 'M83 194', 'M90 199', 'M107 216')):
                    group.remove(node)
            arms = path('M78 216 60 215 43 245 59 254 82 234M153 215 171 216 190 246 173 254 151 234Z', f'url(#hero-{color})')
            group.insert(2, arms)
            group.append(path('M46 243Q35 245 41 258L51 264Q65 266 65 254L59 247ZM176 247Q171 256 181 264L191 261Q202 254 190 245Z', 'url(#hero-skin)', **{'stroke-width': '5'}))
            if mood == 'sad':
                group.append(path('M65 172Q80 184 97 174M132 174Q148 184 164 171M65 161 92 166M137 166 164 160', **{'stroke-width': '5'}))
                group.append(path('M93 205C90 184 140 184 142 205C143 224 92 226 93 205Z', '#331b19', **{'stroke-width': '5'}))
                group.append(path('M102 216Q118 204 133 216Q117 225 102 216Z', '#ee7d79', stroke='none'))
                group.append(path('M61 177Q47 190 54 202Q63 208 67 198Q70 189 61 177ZM170 177Q181 190 179 202Q172 210 166 201Q162 190 170 177Z', '#8edbff', **{'stroke-width': '3'}))
            else:
                group.append(path('M67 174Q81 166 97 174M132 174Q148 166 163 174M99 201Q115 208 132 201', **{'stroke-width': '5'}))
        export(f'{color}-{mood}', group, heroes.find(f'{{{SVG}}}defs'), '0 35 230 270', f'{color}: {mood}')

for color, frame in [('blue', 'referee-blue-top'), ('red', 'referee-red-turn'), ('neutral', 'referee-neutral')]:
    group = deepcopy(next(node for node in referees.iter() if node.get('id') == frame))
    # The winner is always on the right of the result scene. These source poses
    # raise the colored flag on the left; mirror the whole pose, including gaze.
    if color != 'neutral':
        wrapper = ET.Element(f'{{{SVG}}}g', {'transform': 'translate(320 0) scale(-1 1)'})
        wrapper.append(group)
        group = wrapper
    export(f'referee-{color}', group, referees.find(f'{{{SVG}}}defs'), '0 0 320 240', f'Schiedsrichter: {color}')
print('Nine SVG endgame poses exported to public/endgame.')
