"""Optional build-time tracing for the original ICQ Retro artwork.

Dependencies: Pillow and a system libpotrace, e.g. supplied by Inkscape.
There are no game/runtime dependencies, NumPy, embedded images, or fonts.
The C ABI follows https://potrace.sourceforge.net/potracelib.pdf.

trace_rgba(image, id_prefix="own-rock") returns an SVG fragment in the
image's original local 0..width / 0..height coordinates. Use a distinct
id_prefix for every fragment placed into the same document.
vectorize(image, **kwargs) wraps the fragment in a complete SVG document.
trace_mask(mask) is also public for hand-selected regions and gradients.
"""
import ctypes as C
import ctypes.util
import re
from PIL import Image, ImageChops, ImageFilter

class Point(C.Structure):
    _fields_ = [('x', C.c_double), ('y', C.c_double)]

class Curve(C.Structure):
    _fields_ = [('n', C.c_int), ('tag', C.POINTER(C.c_int)), ('c', C.POINTER(Point * 3))]

class TracePath(C.Structure):
    pass

TracePath._fields_ = [('area', C.c_int), ('sign', C.c_int), ('curve', Curve),
    ('next', C.POINTER(TracePath)), ('childlist', C.POINTER(TracePath)),
    ('sibling', C.POINTER(TracePath)), ('priv', C.c_void_p)]

class State(C.Structure):
    _fields_ = [('status', C.c_int), ('plist', C.POINTER(TracePath)), ('priv', C.c_void_p)]

class ParamsPrefix(C.Structure):
    _fields_ = [('turdsize', C.c_int), ('turnpolicy', C.c_int), ('alphamax', C.c_double),
                ('opticurve', C.c_int), ('opttolerance', C.c_double)]

class Bitmap(C.Structure):
    _fields_ = [('w', C.c_int), ('h', C.c_int), ('dy', C.c_int), ('map', C.POINTER(C.c_ulong))]

_library_name = C.util.find_library('potrace')
if not _library_name:
    raise RuntimeError('The optional SVG build tool requires libpotrace (provided by Potrace or Inkscape).')
LIB = C.CDLL(_library_name)
LIB.potrace_param_default.argtypes = []
LIB.potrace_param_default.restype = C.POINTER(ParamsPrefix)
LIB.potrace_param_free.argtypes = [C.POINTER(ParamsPrefix)]
LIB.potrace_param_free.restype = None
LIB.potrace_trace.argtypes = [C.POINTER(ParamsPrefix), C.POINTER(Bitmap)]
LIB.potrace_trace.restype = C.POINTER(State)
LIB.potrace_state_free.argtypes = [C.POINTER(State)]
LIB.potrace_state_free.restype = None

def trace_mask(mask, turdsize=1, alphamax=1.0, opttolerance=0.15):
    """Trace a binary PIL mask into a compound SVG path in local pixel coordinates."""
    mask = mask.convert('1', dither=Image.Dither.NONE)
    width, height = mask.size
    rowbytes = (width + 7) // 8
    wordbytes = C.sizeof(C.c_ulong)
    words = (rowbytes + wordbytes - 1) // wordbytes
    raw = mask.tobytes()
    packed = (C.c_ulong * (words * height))()
    for y in range(height):
        row = raw[y*rowbytes:(y+1)*rowbytes]
        for x in range(words):
            packed[y*words+x] = int.from_bytes(row[x*wordbytes:(x+1)*wordbytes].ljust(wordbytes, b'\0'), 'big')
    bitmap = Bitmap(width, height, words, packed)
    params = LIB.potrace_param_default()
    if not params:
        raise MemoryError('Potrace params')
    params.contents.turdsize = turdsize
    params.contents.alphamax = alphamax
    params.contents.opticurve = 1
    params.contents.opttolerance = opttolerance
    state = LIB.potrace_trace(params, C.byref(bitmap))
    try:
        if not state or state.contents.status != 0:
            raise RuntimeError('Potrace trace failed')
        paths = []
        pointer = state.contents.plist
        def p(value):
            return f'{value.x:.2f},{value.y:.2f}'
        while pointer:
            path = pointer.contents
            curve = path.curve
            if curve.n == 0:
                pointer = path.next
                continue
            commands = ['M' + p(curve.c[curve.n-1][2])]
            for i in range(curve.n):
                control = curve.c[i]
                if curve.tag[i] == 2:
                    commands.append('L' + p(control[1]) + ' ' + p(control[2]))
                else:
                    commands.append('C' + ' '.join(p(control[j]) for j in range(3)))
            commands.append('Z')
            paths.append(''.join(commands))
            pointer = path.next
        return ''.join(paths)
    finally:
        if state:
            LIB.potrace_state_free(state)
        LIB.potrace_param_free(params)

def _palette(rgb, colors):
    """Median-cut colors plus protected neutral tones for eyes and hair."""
    gray_levels = [0, 8, 16, 24, 32, 48, 64, 80, 100, 128, 160, 192, 216, 232, 248, 255]
    initial = rgb.quantize(colors=colors - len(gray_levels),
                           method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    values = initial.getpalette()[:(colors - len(gray_levels)) * 3]
    for value in gray_levels:
        values.extend([value] * 3)
    palette_image = Image.new('P', (1, 1))
    palette_image.putpalette(values + values[-3:] * (256 - colors))
    quantized = rgb.quantize(palette=palette_image, dither=Image.Dither.NONE)

    # A global palette can otherwise map small white eyes, stone shading or
    # hair highlights onto a similarly bright skin tone. Retain neutral RGB.
    red, green, blue = rgb.split()
    maximum = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    minimum = ImageChops.darker(ImageChops.darker(red, green), blue)
    neutral = ImageChops.subtract(maximum, minimum).point(lambda p: 255 if p <= 20 else 0)
    palette = quantized.getpalette()
    neutral_indices, neutral_lumas = [], []
    for index in range(colors):
        channels = palette[index * 3:index * 3 + 3]
        if max(channels) - min(channels) <= 20:
            luma = round(sum(c * weight for c, weight in zip(channels, (.299, .587, .114))))
            palette[index * 3:index * 3 + 3] = [luma] * 3
            neutral_indices.append(index)
            neutral_lumas.append(luma)
    quantized.putpalette(palette)
    lookup = [neutral_indices[min(range(len(neutral_indices)),
                                  key=lambda i: abs(neutral_lumas[i] - value))]
              for value in range(256)]
    indices = rgb.convert('L').point(lookup)
    neutral_quantized = Image.frombytes('P', rgb.size, indices.tobytes())
    neutral_quantized.putpalette(palette)
    quantized.paste(neutral_quantized, mask=neutral)
    return quantized


def trace_rgba(image, *, colors=128, id_prefix='retro', alpha_threshold=128,
               median=True, mask_smoothing=0.65):
    """Return vector-only SVG markup preserving the source frame coordinates.

    colors=128 is the detail/size compromise; 256 retains additional shading.
    A 3x3 median removes faint bitmap grain, while mask_smoothing=0.65 rounds
    very small quantization islands. The silhouette remains independently
    traced from source alpha. Alpha below 128 is discarded to remove nearly
    transparent source noise; the SVG renderer supplies edge antialiasing.
    """
    if not 32 <= colors <= 256:
        raise ValueError('colors must be between 32 and 256')
    if not 1 <= alpha_threshold <= 255:
        raise ValueError('alpha_threshold must be between 1 and 255')
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_.-]*', id_prefix):
        raise ValueError('id_prefix must be a safe, unique SVG identifier')
    image = image.convert('RGBA')
    alpha = image.getchannel('A').point(lambda p: 255 if p >= alpha_threshold else 0)
    if not alpha.getbbox():
        return ''
    rgb = Image.new('RGB', image.size, 'black')
    rgb.paste(image.convert('RGB'), mask=alpha)
    if median:
        rgb = rgb.filter(ImageFilter.MedianFilter(3))
    quantized = _palette(rgb, colors)
    palette = quantized.getpalette()
    silhouette = trace_mask(alpha, turdsize=2, opttolerance=0.15)
    clip_id = id_prefix + '-silhouette'
    parts = [f'<defs><clipPath id="{clip_id}"><path d="{silhouette}"/></clipPath></defs>',
             f'<g clip-path="url(#{clip_id})"><path fill="#080808" d="{silhouette}"/>']
    order = [index for _, index in sorted(quantized.getcolors(), reverse=True)]
    order.sort(key=lambda index: sum(c * weight for c, weight in
                   zip(palette[index * 3:index * 3 + 3], (.2126, .7152, .0722))))
    # Cumulative dark-to-light masks overlap. Independent cutouts develop
    # pinholes after smooth curve fitting, which would expose the black base.
    for step, index in enumerate(order):
        members = set(order[step:])
        mask = quantized.point([255 if i in members else 0 for i in range(256)], 'L')
        if mask_smoothing:
            mask = mask.filter(ImageFilter.GaussianBlur(mask_smoothing))
            mask = mask.point(lambda p: 255 if p >= 128 else 0)
        mask = ImageChops.multiply(mask, alpha)
        if not mask.getbbox():
            continue
        path = trace_mask(mask, turdsize=1, opttolerance=0.12)
        if path:
            color = '#' + ''.join(f'{p:02x}' for p in palette[index * 3:index * 3 + 3])
            parts.append(f'<path fill="{color}" d="{path}"/>')
    parts.append('</g>')
    return ''.join(parts)


def vectorize(image, **kwargs):
    """Return a complete standalone SVG, using trace_rgba's keyword options."""
    width, height = image.size
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="0 0 {width} {height}">' + trace_rgba(image, **kwargs) + '</svg>')
