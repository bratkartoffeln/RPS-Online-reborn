#!/usr/bin/env python3
"""Rebuild the original Arcade skin: python3 scripts/generate-skin-atlas.py.

Requires Pillow only (python3 -m pip install Pillow). The same editable shape
primitives produce atlas.png and master.svg. No downloaded art or fonts.
The SVG is the preferred atlas; the PNG remains its matching fallback.
SVG edits can instead be exported at their native 1152 x 1248 pixel size.
Only Arcade files are rebuilt; the skin catalog and other skins are preserved.
"""
from __future__ import annotations

import json
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "skins"
CELL, SCALE, COLUMNS, ROWS = 96, 4, 12, 13
KINDS = ("rock", "paper", "scissors", "flag", "trap", "unknown")
STATES = ("idle-0", "idle-1", "selected-0", "selected-1", "selected-2",
          "move-0", "move-1", "duel-0", "duel-1", "attack-1", "win-1", "lose-1")
COLORS = {
    "own": dict(edge="#73b2ff", dark="#132e64", base="#205dc1", top="#337ddb", icon="#ecf5ff", detail="#9bcaff"),
    "enemy": dict(edge="#ff8b84", dark="#641f29", base="#b9333e", top="#db4e55", icon="#fff1ed", detail="#ffb5ad"),
}
LIME, GOLD, INK = "#d4f57b", "#ffcf7e", "#111f27"


class Cell:
    """Small vector vocabulary rendered to SVG and antialiased RGBA together."""
    def __init__(self) -> None:
        self.image = Image.new("RGBA", (CELL * SCALE, CELL * SCALE), (0, 0, 0, 0))
        self.draw = ImageDraw.Draw(self.image)
        self.svg: list[str] = []

    def coords(self, points):
        return [(round(x * SCALE), round(y * SCALE)) for x, y in points]

    def poly(self, points, fill, stroke=None, width=1):
        points = list(points)
        self.draw.polygon(self.coords(points), fill=fill)
        if stroke:
            self.draw.line(self.coords(points + [points[0]]), fill=stroke, width=round(width * SCALE), joint="curve")
        path = " ".join(f"{x:g},{y:g}" for x, y in points)
        self.svg.append(f'<polygon points="{path}" fill="{fill or "none"}" stroke="{stroke or "none"}" stroke-width="{width}" stroke-linejoin="round"/>')

    def line(self, points, fill, width=2, caps=True):
        points = list(points)
        self.draw.line(self.coords(points), fill=fill, width=round(width * SCALE), joint="curve")
        if caps:
            radius = width / 2
            for x, y in (points[0], points[-1]):
                self.draw.ellipse((round((x-radius)*SCALE), round((y-radius)*SCALE), round((x+radius)*SCALE), round((y+radius)*SCALE)), fill=fill)
        path = " ".join(f"{x:g},{y:g}" for x, y in points)
        self.svg.append(f'<polyline points="{path}" fill="none" stroke="{fill}" stroke-width="{width}" stroke-linecap="{"round" if caps else "butt"}" stroke-linejoin="round"/>')

    def ellipse(self, bounds, fill=None, stroke=None, width=1):
        x0, y0, x1, y1 = bounds
        self.draw.ellipse(tuple(round(value*SCALE) for value in bounds), fill=fill, outline=stroke, width=max(1, round(width*SCALE)))
        self.svg.append(f'<ellipse cx="{(x0+x1)/2:g}" cy="{(y0+y1)/2:g}" rx="{(x1-x0)/2:g}" ry="{(y1-y0)/2:g}" fill="{fill or "none"}" stroke="{stroke or "none"}" stroke-width="{width}"/>')

    def rect(self, bounds, fill):
        x0, y0, x1, y1 = bounds
        self.draw.rectangle(tuple(round(value*SCALE) for value in bounds), fill=fill)
        self.svg.append(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" fill="{fill}"/>')

    def finish(self, alpha=1.0):
        if alpha != 1:
            self.image.putalpha(self.image.getchannel("A").point(lambda value: round(value * alpha)))
            self.svg = [f'<g opacity="{alpha}">', *self.svg, '</g>']
        return self.image.resize((CELL, CELL), Image.Resampling.LANCZOS), "\n".join(self.svg)


def badge_outline(dx=0, dy=0, inset=0):
    return [(x + dx, y + dy) for x, y in (
        (20 + inset, 9 + inset), (76 - inset, 9 + inset),
        (87 - inset, 20 + inset), (87 - inset, 72 - inset),
        (75 - inset, 85 - inset), (21 + inset, 85 - inset),
        (9 + inset, 73 - inset), (9 + inset, 20 + inset),
    )]


def spark(cell, x, y, size, color):
    cell.poly([(x,y-size),(x+size*.35,y-size*.35),(x+size,y),
               (x+size*.35,y+size*.35),(x,y+size),(x-size*.35,y+size*.35),
               (x-size,y),(x-size*.35,y-size*.35)], color)


def symbol(cell, kind, color, shade, dx=0, dy=0, size=1.0, center=(48, 46), flag_colors=None):
    # All marks share the same 48 x 48 optical box and contain no font glyphs.
    def points(values):
        return [(center[0] + (x-48)*size + dx, center[1] + (y-46)*size + dy) for x,y in values]
    def poly(values, fill=color, stroke=None, width=1):
        cell.poly(points(values), fill, stroke, width*size)
    def line(values, fill=color, width=3):
        cell.line(points(values), fill, width*size)
    def circle(x,y,r,fill=None,stroke=color,width=3):
        transformed = points([(x-r,y-r),(x+r,y+r)])
        cell.ellipse((*transformed[0],*transformed[1]), fill, stroke, width*size)
    if kind == "rock":
        poly([(37,26),(56,27),(69,45),(59,65),(35,65),(26,47)])
        poly([(37,26),(44,45),(26,47)], shade)
        poly([(44,45),(59,65),(69,45)], shade)
        line([(37,27),(44,45),(68,45)], INK, 1.5)
        line([(44,45),(35,64)], INK, 1.5)
        line([(44,45),(59,64)], INK, 1.5)
    elif kind == "paper":
        poly([(33,24),(52,24),(64,36),(64,68),(33,68)])
        poly([(52,24),(52,36),(64,36)], shade)
        line([(52,25),(52,36),(63,36)], INK, 1.6)
        line([(41,47),(56,47)], INK, 2.8)
        line([(41,55),(56,55)], INK, 2.8)
        line([(41,62),(50,62)], shade, 2.2)
    elif kind == "scissors":
        poly([(36,54),(31,24),(35,23),(49,45),(64,23),(68,25),(58,55),(49,48)], color)
        line([(49,46),(41,58)], color, 4)
        line([(49,46),(56,58)], color, 4)
        circle(36,61,9,None,color,4.3)
        circle(60,61,9,None,color,4.3)
        circle(49,46,2.8,INK,None)
        line([(35,28),(44,43)], shade, 2)
    elif kind == "flag":
        cloth, fold = flag_colors or (color, shade)
        line([(34,68),(34,24)], color, 4)
        poly([(36,26),(67,26),(58,37),(67,47),(36,47)], cloth)
        poly([(36,26),(67,26),(59,36),(36,36)], fold)
        line([(26,69),(44,69)], color, 4)
        circle(34,23,2.4,color,None)
    elif kind == "trap":
        for sx,sy in ((-1,-1),(1,-1),(-1,1),(1,1)):
            line([(48+sx*10,46+sy*10),(48+sx*19,46+sy*19)], shade, 4)
            poly([(48+sx*22,46+sy*23),(48+sx*22,46+sy*8),
                  (48+sx*17,46+sy*13),(48+sx*11,46+sy*13),
                  (48+sx*11,46+sy*18),(48+sx*16,46+sy*18)], color)
        circle(48,46,11,None,color,3.5)
        poly([(48,39),(55,46),(48,53),(41,46)], shade)
    elif kind == "unknown":
        poly([(48,23),(68,33),(65,53),(57,64),(48,70),(39,64),(31,53),(28,33)], shade)
        poly([(48,27),(64,35),(61,53),(55,61),(48,66),(41,61),(35,53),(32,35)], INK)
        line([(41,40),(41,36),(45,33),(51,33),(55,36),(55,41),(48,47),(48,50)], color, 3.5)
        circle(48,57,1.9,color,None)


def piece_cell(team, kind, state):
    cell = Cell()
    colors = COLORS[team]
    dy = -1 if state in ("idle-1", "selected-1", "win-1") else 0
    selected = state.startswith("selected")
    duel = state.startswith("duel")
    attacking = state == "attack-1"
    winning = state == "win-1"
    losing = state == "lose-1"
    moving = state.startswith("move")
    rim = LIME if selected or winning else GOLD if duel or attacking else colors["edge"]
    # Deliberate clear space at every cell edge prevents atlas sampling bleed.
    if winning:
        for x,y,s in ((7,11,5),(88,15,5),(89,84,4),(8,79,4),(49,3,3)):
            spark(cell,x,y,s,LIME)
    if attacking:
        for start,end in (((5,30),(1,26)),((90,38),(95,34)),((17,5),(13,1)),((80,89),(84,94))):
            cell.line([start,end],GOLD,2)
    cell.poly(badge_outline(dy=5), "#09151e")
    cell.poly(badge_outline(dy=dy), rim)
    cell.poly(badge_outline(dy=dy, inset=2), colors["dark"])
    cell.poly([(21,14+dy),(75,14+dy),(82,22+dy),(82,68+dy),(73,78+dy),(23,78+dy),(14,69+dy),(14,22+dy)], colors["base"])
    cell.poly([(21,14+dy),(75,14+dy),(82,22+dy),(82,35+dy),(14,48+dy),(14,22+dy)], colors["top"])
    cell.line([(24,17+dy),(72,17+dy)], rim if state == "idle-1" else colors["detail"], 1.4)
    cell.line([(23,80+dy),(73,80+dy)], colors["dark"], 2)
    cell.ellipse((17,23+dy,20,26+dy), colors["detail"])
    cell.ellipse((76,23+dy,79,26+dy), colors["detail"])
    # Team markers keep the token distinct even when color differences are muted.
    if team == "own":
        for x in (39,47,55):
            cell.rect((x,74+dy,x+3,76+dy),colors["detail"])
    else:
        cell.poly([(48,72+dy),(53,75+dy),(48,78+dy),(43,75+dy)],colors["detail"])
    # Only flag cloth carries the opponent's target color. All other token shapes retain their team.
    target = COLORS["enemy" if team == "own" else "own"]
    flag_colors = (target["top"], target["detail"]) if kind == "flag" else None
    symbol(cell,kind,colors["icon"],colors["detail"],dy=dy + (-1 if moving else 0),flag_colors=flag_colors)
    if selected:
        step = int(state[-1])
        offset = (0,2,0)[step]
        for pts in (
            [(5,30-offset),(5,18-offset),(16,7-offset)],
            [(80,7-offset),(91,18-offset),(91,30-offset)],
            [(5,63+offset),(5,75+offset),(17,89+offset)],
            [(79,89+offset),(91,75+offset),(91,63+offset)],
        ):
            cell.line(pts,LIME,1.8)
        spark(cell,79-step*9,10,2.3,LIME)
    if moving:
        for y, length in ((30,5),(45,7),(60,4)):
            if state == "move-1": y -= 5
            cell.line([(3,y),(3,y+length)],colors["detail"],2)
            cell.line([(93,y+7),(93,y+7+length)],colors["detail"],2)
    if duel:
        for x in (31,43,55):
            cell.poly([(x,7),(x+4,3 if state == "duel-1" else 5),(x+8,7)],GOLD)
        cell.line([(20,84),(76,84)],GOLD,2.5 if state == "duel-1" else 1.2)
    if attacking:
        cell.line([(17,72),(27,69)],GOLD,2)
        cell.line([(71,24),(81,21)],GOLD,2)
        spark(cell,77,15,6,GOLD)
    if winning:
        cell.poly([(36,10),(34,2),(43,6),(48,0),(53,6),(62,2),(60,10)],LIME)
        cell.line([(30,83),(66,83)],LIME,3)
    if losing:
        cell.line([(56,15),(47,31),(52,40),(42,54),(47,62),(38,79)],INK,2.8)
        cell.line([(51,40),(62,43)],INK,1.6)
    return cell.finish(0.42 if losing else 1.0)


def tile_cell(light):
    cell = Cell()
    base, top, edge, low = (("#253b45","#2e4852","#44616a","#1c303a") if light
                            else ("#1e303a","#283e47","#354f59","#172832"))
    cell.rect((0,0,96,96),low)
    cell.poly([(0,0),(96,0),(96,91),(91,96),(0,96)],base)
    cell.poly([(1,1),(95,1),(95,4),(1,4)],top)
    cell.line([(1,94),(1,1),(94,1)],edge,1,caps=False)
    cell.line([(4,95),(95,95),(95,4)],low,2,caps=False)
    for x,y in ((8,8),(88,8),(8,88),(88,88)):
        cell.ellipse((x-.7,y-.7,x+.7,y+.7),edge)
    cell.line([(45,48),(51,48)],top,1)
    cell.line([(48,45),(48,51)],top,1)
    return cell.finish()


def logo_cell():
    cell = Cell()
    cell.poly([(27,6),(69,6),(90,28),(90,68),(69,90),(27,90),(6,68),(6,28)],INK)
    cell.poly([(28,10),(68,10),(86,29),(86,67),(68,86),(28,86),(10,67),(10,29)],LIME)
    cell.poly([(32,18),(64,18),(78,32),(78,63),(63,78),(33,78),(18,64),(18,32)],"#254850")
    cell.poly([(32,18),(64,18),(78,32),(18,56),(18,32)],"#396d75")
    symbol(cell,"rock","#ecffd3","#bbde80",size=1.03,center=(48,46))
    cell.poly([(70,64),(80,64),(75,72)],LIME)
    cell.line([(32,81),(64,81)],LIME,2)
    return cell.finish()


def generate():
    (OUTPUT / "arcade").mkdir(parents=True,exist_ok=True)
    atlas = Image.new("RGBA",(CELL*COLUMNS,CELL*ROWS),(0,0,0,0))
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{CELL*COLUMNS}" height="{CELL*ROWS}" viewBox="0 0 {CELL*COLUMNS} {CELL*ROWS}">',
           '<title>RPS Arena — Arcade, editable original sprite atlas</title>',
           '<desc>12 rows: blue player 1 (own), then red player 2 (enemy); rock, paper, scissors, flag, trap, unknown. Flag cloth marks the opposing team target: red on blue tokens, blue on red tokens. Columns: idle 0/1, selected 0/1/2, move 0/1, duel 0/1, attack, win, lose. Bottom row: board light, board dark, logo. Native export: 1152 × 1248 pixels. All shapes are editable; no linked resources.</desc>']
    frames, pieces = {}, {"own":{},"enemy":{}}

    def place(name,column,row,art):
        bitmap,markup = art
        x,y = column*CELL,row*CELL
        atlas.alpha_composite(bitmap,(x,y))
        svg.append(f'<g id="{escape(name)}" transform="translate({x} {y})">\n{markup}\n</g>')
        frames[name] = dict(x=x,y=y,width=CELL,height=CELL)

    for team_index,team in enumerate(("own","enemy")):
        for kind_index,kind in enumerate(KINDS):
            prefix = f"{team}-{kind}"
            row = team_index*len(KINDS)+kind_index
            for column,state in enumerate(STATES):
                place(f"{prefix}-{state}",column,row,piece_cell(team,kind,state))
            def clip(names,fps):
                return dict(frames=[f"{prefix}-{name}" for name in names],fps=fps)
            pieces[team][kind] = dict(frame=f"{prefix}-idle-0",animations={
                "idle":clip(("idle-0","idle-1","idle-0","idle-0"),2),
                "selected":clip(("selected-0","selected-1","selected-2"),6),
                "move":clip(("move-0","move-1","idle-0"),14),
                "duel":clip(("duel-0","duel-1"),5),
                "attack":clip(("idle-0","attack-1","attack-1","idle-0"),12),
                "win":clip(("selected-0","selected-1","win-1","win-1","idle-0"),10),
                "lose":clip(("idle-0","duel-1","lose-1","lose-1"),8),
            })
    place("board-light",0,12,tile_cell(True))
    place("board-dark",1,12,tile_cell(False))
    place("logo",2,12,logo_cell())
    svg.append("</svg>")
    atlas.save(OUTPUT / "arcade" / "atlas.png",optimize=True)
    (OUTPUT / "arcade" / "master.svg").write_text("\n".join(svg)+"\n",encoding="utf-8")
    skin = {
        "version":1,"name":"Arcade",
        "palette":{
            "ui":{"background":"#101d25","panel":"#192c35","border":"#34505b",
                  "text":"#eef9ef","muted":"#9db5b9","accent":LIME,"accentText":"#203327",
                  "own":COLORS["own"]["detail"],"enemy":COLORS["enemy"]["detail"]},
            "board":{"light":"#253b45","dark":"#1e303a","border":"#44616a",
                     "setupOwn":"#244a80","setupEnemy":"#6b3038","selected":"#4a6146",
                     "accent":LIME,"duel":GOLD,"coordinates":"#9bbdc3","shadow":"#0a1820",
                     "dots":"#9bbdc3","focus":"#ffffff","ownBase":COLORS["own"]["base"],"ownEdge":COLORS["own"]["edge"],
                     "ownSymbol":COLORS["own"]["icon"],"enemyBase":COLORS["enemy"]["base"],"enemyEdge":COLORS["enemy"]["edge"],
                     "enemySymbol":COLORS["enemy"]["icon"],"revealed":LIME}},
        "atlas":{"image":"master.svg","fallbackImage":"atlas.png","frames":frames},
        "board":{"light":"board-light","dark":"board-dark"},"logo":"logo","pieces":pieces,
        "motion":{"moveMs":240,"battleMs":1000},
    }
    (OUTPUT / "arcade" / "skin.json").write_text(json.dumps(skin,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Created {len(frames)} frames: {OUTPUT / 'arcade' / 'atlas.png'} ({atlas.width} x {atlas.height})")


if __name__ == "__main__":
    generate()
