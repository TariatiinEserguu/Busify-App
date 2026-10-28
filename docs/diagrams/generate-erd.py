# -*- coding: utf-8 -*-
"""Render the BUSIFY ER diagram as a hand-laid-out SVG (crow's foot notation).

The entities, columns and relationships mirror server/prisma/schema.prisma.
"""
import html

W = 258          # entity box width
HEAD = 42        # header band height
ROW = 19         # attribute row height
PAD = 8          # padding under the last row
R = 9            # corner radius

GROUPS = {
    # border,     header,    subtitle tint, soft fill
    "auth":    ("#1d4ed8", "#1d4ed8", "#c7d7fe", "#eff6ff"),
    "route":   ("#15803d", "#15803d", "#c9f0d6", "#f0fdf4"),
    "journey": ("#b45309", "#b45309", "#fde6bd", "#fffbeb"),
    "support": ("#7e22ce", "#7e22ce", "#e9d2fb", "#faf5ff"),
    "ops":     ("#475569", "#475569", "#d2dbe6", "#f8fafc"),
}

PK, FK, UQ, PF, SOFT = "PK", "FK", "UQ", "PK FK", "~"
KEY_FILL = {PK: "#b45309", FK: "#1d4ed8", UQ: "#15803d", PF: "#b45309", SOFT: "#94a3b8"}

# name: (x, y, group, subtitle, [(key, column, type, nullable)])
ENT = {
 "Role": (60, 620, "auth", "Дүр (эрхийн бүлэг)", [
    (PK,"id","INT",0),(UQ,"name","TEXT",0),("","label","TEXT",0),("","description","TEXT",0)]),
 "Permission": (60, 800, "auth", "Эрх (зөвшөөрөл)", [
    (PK,"id","INT",0),(UQ,"key","TEXT",0),("","description","TEXT",0)]),
 "RolePermission": (368, 690, "auth", "Дүр–Эрхийн холбоо", [
    (PF,"roleId","INT",0),(PF,"permissionId","INT",0)]),
 "User": (700, 600, "auth", "Хэрэглэгч", [
    (PK,"id","INT",0),(UQ,"email","TEXT",0),("","name","TEXT",0),("","phone","TEXT",1),
    ("","passwordHash","TEXT",0),(FK,"roleId","INT",0),("","status","UserStatus",0),
    ("","mustChangePassword","BOOL",0),("","isDemoAccount","BOOL",0),
    ("","lastLoginAt","DATETIME",1),("","createdAt","DATETIME",0),("","updatedAt","DATETIME",0)]),
 "Session": (700, 250, "auth", "Нэвтрэлтийн сесс", [
    (PK,"id","TEXT",0),(FK,"userId","INT",0),("","createdAt","DATETIME",0),
    ("","expiresAt","DATETIME",0),("","lastUsedAt","DATETIME",0),("","userAgent","TEXT",1),
    ("","ipAddress","TEXT",1)]),
 "UserSettings": (1030, 250, "auth", "Хэрэглэгчийн тохиргоо", [
    (PF,"userId","INT",0),("","alertRadiusM","INT",0),("","soundEnabled","BOOL",0),
    ("","vibrationEnabled","BOOL",0),("","notificationsEnabled","BOOL",0),
    ("","keepScreenAwake","BOOL",0),("","updatedAt","DATETIME",0)]),

 "Journey": (1060, 560, "journey", "Аялал — идэвхтэй сэрэмжлүүлэг", [
    (PK,"id","INT",0),(FK,"userId","INT",0),(FK,"routeId","INT",1),
    (FK,"destinationStopId","INT",1),("","routeNumber","TEXT",0),("","routeName","TEXT",0),
    ("","destinationName","TEXT",0),("","destinationLat","REAL",0),("","destinationLng","REAL",0),
    ("","alertRadiusM","INT",0),("","status","JourneyStatus",0),("","startedAt","DATETIME",0),
    ("","pausedAt","DATETIME",1),("","endedAt","DATETIME",1),("","endReason","TEXT",1),
    ("","alertTriggeredAt","DATETIME",1),("","alertDistanceM","REAL",1),("","alertCount","INT",0),
    ("","alertRearmPending","BOOL",0),("","lastDistanceM","REAL",1),("","lastAccuracyM","REAL",1),
    ("","lastPositionAt","DATETIME",1),("","usedSimulation","BOOL",0),("","updatedAt","DATETIME",0)]),

 "Route": (1420, 500, "route", "Маршрут", [
    (PK,"id","INT",0),(UQ,"number","TEXT",0),("","name","TEXT",0),("","description","TEXT",0),
    ("","status","RouteStatus",0),("","color","TEXT",0),("","firstDeparture","TEXT",1),
    ("","lastDeparture","TEXT",1),("","headwayMinutes","INT",1),("","isDemo","BOOL",0),
    ("","createdAt","DATETIME",0),("","updatedAt","DATETIME",0)]),
 "Stop": (1420, 830, "route", "Буудал", [
    (PK,"id","INT",0),(UQ,"code","TEXT",1),("","name","TEXT",0),("","description","TEXT",0),
    ("","latitude","REAL",0),("","longitude","REAL",0),("","isDemo","BOOL",0),
    ("","createdAt","DATETIME",0),("","updatedAt","DATETIME",0)]),
 "RouteStop": (1750, 640, "route", "Маршрут дахь буудлын дараалал", [
    (PK,"id","INT",0),(FK,"routeId","INT",0),(FK,"stopId","INT",0),("","position","INT",0)]),

 "SupportTicket": (2060, 480, "support", "Гомдол, санал хүсэлт", [
    (PK,"id","INT",0),(FK,"userId","INT",0),("","subject","TEXT",0),("","description","TEXT",0),
    ("","category","TicketCategory",0),("","priority","TicketPriority",0),
    ("","status","TicketStatus",0),(FK,"routeId","INT",1),(FK,"journeyId","INT",1),
    (FK,"assignedToId","INT",1),("","escalated","BOOL",0),("","escalatedAt","DATETIME",1),
    (FK,"escalatedById","INT",1),("","escalationReason","TEXT",1),("","resolvedAt","DATETIME",1),
    ("","createdAt","DATETIME",0),("","updatedAt","DATETIME",0)]),
 "SupportResponse": (2400, 360, "support", "Хариу / дотоод тэмдэглэл", [
    (PK,"id","INT",0),(FK,"ticketId","INT",0),(FK,"authorId","INT",0),("","message","TEXT",0),
    ("","isInternal","BOOL",0),("","createdAt","DATETIME",0)]),
 "TicketEvent": (2400, 600, "support", "Гомдол дээрх үйлдлийн түүх", [
    (PK,"id","INT",0),(FK,"ticketId","INT",0),(FK,"actorId","INT",1),
    ("","type","TicketEventType",0),("","fromStatus","TicketStatus",1),
    ("","toStatus","TicketStatus",1),("","note","TEXT",1),("","createdAt","DATETIME",0)]),

 "Notification": (60, 1270, "ops", "Мэдэгдэл", [
    (PK,"id","INT",0),(FK,"userId","INT",0),("","type","TEXT",0),("","title","TEXT",0),
    ("","body","TEXT",0),("","link","TEXT",1),("","readAt","DATETIME",1),
    ("","createdAt","DATETIME",0)]),
 "AuditLog": (390, 1270, "ops", "Аудитын бүртгэл", [
    (PK,"id","INT",0),(FK,"actorId","INT",1),("","action","TEXT",0),("","entityType","TEXT",0),
    ("","entityId","TEXT",1),("","summary","TEXT",0),("","metadata","JSON",1),
    ("","ipAddress","TEXT",1),("","createdAt","DATETIME",0)]),
 "ErrorLog": (720, 1270, "ops", "Алдааны бүртгэл", [
    (PK,"id","INT",0),("","source","ErrorSource",0),("","message","TEXT",0),("","stack","TEXT",1),
    ("","method","TEXT",1),("","path","TEXT",1),("","statusCode","INT",1),
    (SOFT,"userId","INT",1),("","userAgent","TEXT",1),("","context","JSON",1),
    ("","createdAt","DATETIME",0)]),
 "SystemSetting": (1050, 1270, "ops", "Системийн тохиргоо", [
    (PK,"key","TEXT",0),("","value","TEXT",0),(SOFT,"updatedById","INT",1),
    ("","updatedAt","DATETIME",0)]),
}

def box_h(name):
    return HEAD + len(ENT[name][4]) * ROW + PAD

def row_y(name, col):
    x, y, _g, _s, cols = ENT[name]
    for i, c in enumerate(cols):
        if c[1] == col:
            return y + HEAD + i * ROW + ROW / 2
    raise KeyError(f"{name}.{col}")

def left(name):  return ENT[name][0]
def right(name): return ENT[name][0] + W
def top(name):   return ENT[name][1]
def bottom(name):return ENT[name][1] + box_h(name)

# ---------------------------------------------------------------- relationships
# Each edge: start point, orthogonal corner points, end point (always the child's
# FK row on its left edge), parent cardinality and an optional Mongolian label.
def E_hvh(p, pcol, c, ccol, cx, **kw):
    """parent right edge -> corridor x -> child left edge."""
    ys, ye = row_y(p, pcol), row_y(c, ccol)
    return dict(start=(right(p), ys), pts=[(cx, ys), (cx, ye)],
                end=(left(c), ye), pdir=(1, 0), cdir=(-1, 0), child=c, **kw)

def E_back(p, pcol, c, ccol, cx, **kw):
    """parent sits to the RIGHT of the child: leave parent's left edge, come back."""
    ys, ye = row_y(p, pcol), row_y(c, ccol)
    return dict(start=(left(p), ys), pts=[(cx, ys), (cx, ye)],
                end=(right(c), ye), pdir=(-1, 0), cdir=(1, 0), child=c, **kw)

def E_pts(start, pts, end, pdir, cdir, child, **kw):
    return dict(start=start, pts=pts, end=end, pdir=pdir, cdir=cdir, child=child, **kw)

U_ID = lambda: (right("User"), row_y("User", "id"))

EDGES = [
    E_hvh("Role", "id", "RolePermission", "roleId", 335),
    E_hvh("Permission", "id", "RolePermission", "permissionId", 348),
    E_hvh("Role", "id", "User", "roleId", 660, label="эрх олгоно", lxy=(452, 663)),

    # User -> Session / UserSettings (leave the top edge)
    E_pts((760, top("User")), [(760, 500), (666, 500), (666, row_y("Session", "userId"))],
          (left("Session"), row_y("Session", "userId")), (0, -1), (-1, 0), "Session",
          label="нэвтэрнэ", lxy=(690, 492)),
    E_pts((860, top("User")), [(860, 520), (996, 520), (996, row_y("UserSettings", "userId"))],
          (left("UserSettings"), row_y("UserSettings", "userId")), (0, -1), (-1, 0),
          "UserSettings", one2one=True, label="тохируулна", lxy=(872, 512)),

    E_hvh("User", "id", "Journey", "userId", 1012, label="аялал эхлүүлнэ", lxy=(966, 616)),

    # Routes and stops
    E_hvh("Route", "id", "RouteStop", "routeId", 1714),
    E_hvh("Stop", "id", "RouteStop", "stopId", 1722),
    E_back("Route", "id", "Journey", "routeId", 1370, opt=True,
           label="маршрут", lxy=(1330, 545)),
    E_back("Stop", "id", "Journey", "destinationStopId", 1352, opt=True,
           label="буух буудал", lxy=(1324, 875)),

    # User -> support (long corridor underneath journey / routes)
    E_pts(U_ID(), [(1050, row_y("User", "id")), (1050, 1094), (2026, 1094),
                   (2026, row_y("SupportTicket", "userId"))],
          (left("SupportTicket"), row_y("SupportTicket", "userId")), (1, 0), (-1, 0),
          "SupportTicket", label="гомдол гаргана", lxy=(1468, 1089)),
    E_pts(U_ID(), [(1035, row_y("User", "id")), (1035, 1110), (2036, 1110),
                   (2036, row_y("SupportTicket", "assignedToId"))],
          (left("SupportTicket"), row_y("SupportTicket", "assignedToId")), (1, 0), (-1, 0),
          "SupportTicket", opt=True, label="хариуцна", lxy=(1660, 1105)),
    E_pts(U_ID(), [(1020, row_y("User", "id")), (1020, 1126), (2046, 1126),
                   (2046, row_y("SupportTicket", "escalatedById"))],
          (left("SupportTicket"), row_y("SupportTicket", "escalatedById")), (1, 0), (-1, 0),
          "SupportTicket", opt=True, label="админд дамжуулна", lxy=(1826, 1121)),
    E_pts(U_ID(), [(1005, row_y("User", "id")), (1005, 1142), (2345, 1142),
                   (2345, row_y("SupportResponse", "authorId"))],
          (left("SupportResponse"), row_y("SupportResponse", "authorId")), (1, 0), (-1, 0),
          "SupportResponse", label="хариу бичнэ", lxy=(2040, 1137)),
    E_pts(U_ID(), [(990, row_y("User", "id")), (990, 1158), (2360, 1158),
                   (2360, row_y("TicketEvent", "actorId"))],
          (left("TicketEvent"), row_y("TicketEvent", "actorId")), (1, 0), (-1, 0),
          "TicketEvent", opt=True, label="үйлдэл хийнэ", lxy=(2180, 1153)),

    # Journey / Route -> ticket
    E_pts((1200, bottom("Journey")), [(1200, 1078), (2016, 1078),
                                      (2016, row_y("SupportTicket", "journeyId"))],
          (left("SupportTicket"), row_y("SupportTicket", "journeyId")), (0, 1), (-1, 0),
          "SupportTicket", opt=True, label="холбогдох аялал", lxy=(1250, 1073)),
    E_pts((right("Route"), row_y("Route", "id")),
          [(1730, row_y("Route", "id")), (1730, 460), (2056, 460),
           (2056, row_y("SupportTicket", "routeId"))],
          (left("SupportTicket"), row_y("SupportTicket", "routeId")), (1, 0), (-1, 0),
          "SupportTicket", opt=True, label="холбогдох маршрут", lxy=(1770, 452)),

    # Ticket -> responses / events
    E_hvh("SupportTicket", "id", "SupportResponse", "ticketId", 2370, label="хариу авна",
          lxy=(2330, 470)),
    E_hvh("SupportTicket", "id", "TicketEvent", "ticketId", 2380, label="түүх үүснэ",
          lxy=(2330, 612)),

    # User -> operational tables (leave the bottom edge)
    E_pts((740, bottom("User")), [(740, 1180), (24, 1180), (24, row_y("Notification", "userId"))],
          (left("Notification"), row_y("Notification", "userId")), (0, 1), (-1, 0),
          "Notification", label="мэдэгдэл хүлээн авна", lxy=(270, 1175)),
    E_pts((790, bottom("User")), [(790, 1194), (355, 1194), (355, row_y("AuditLog", "actorId"))],
          (left("AuditLog"), row_y("AuditLog", "actorId")), (0, 1), (-1, 0),
          "AuditLog", opt=True, label="үйлдэл бүртгэгдэнэ", lxy=(470, 1189)),
]

SOFT_EDGES = [
    E_pts((840, bottom("User")), [(840, 1208), (686, 1208), (686, row_y("ErrorLog", "userId"))],
          (left("ErrorLog"), row_y("ErrorLog", "userId")), (0, 1), (-1, 0), "ErrorLog",
          opt=True, label="логик холбоо", lxy=(690, 1203)),
    E_pts((890, bottom("User")), [(890, 1222), (1016, 1222),
                                  (1016, row_y("SystemSetting", "updatedById"))],
          (left("SystemSetting"), row_y("SystemSetting", "updatedById")), (0, 1), (-1, 0),
          "SystemSetting", opt=True, label="логик холбоо", lxy=(900, 1217)),
]

# ---------------------------------------------------------------------- drawing
def esc(s): return html.escape(str(s), quote=True)

def rounded_path(pts, r=R):
    """Orthogonal polyline with rounded corners."""
    if len(pts) < 2:
        return ""
    d = [f"M {pts[0][0]:.1f} {pts[0][1]:.1f}"]
    for i in range(1, len(pts) - 1):
        x0, y0 = pts[i - 1]; x1, y1 = pts[i]; x2, y2 = pts[i + 1]
        d1 = (x1 - x0, y1 - y0); d2 = (x2 - x1, y2 - y1)
        l1 = max(abs(d1[0]), abs(d1[1])); l2 = max(abs(d2[0]), abs(d2[1]))
        rr = min(r, l1 / 2, l2 / 2)
        if rr <= 0.5:
            d.append(f"L {x1:.1f} {y1:.1f}")
            continue
        ux1 = d1[0] / l1 if l1 else 0; uy1 = d1[1] / l1 if l1 else 0
        ux2 = d2[0] / l2 if l2 else 0; uy2 = d2[1] / l2 if l2 else 0
        d.append(f"L {x1 - ux1 * rr:.1f} {y1 - uy1 * rr:.1f}")
        d.append(f"Q {x1:.1f} {y1:.1f} {x1 + ux2 * rr:.1f} {y1 + uy2 * rr:.1f}")
    d.append(f"L {pts[-1][0]:.1f} {pts[-1][1]:.1f}")
    return " ".join(d)

def crow(x, y, dx, dy, color):
    """Crow's foot at the 'many' end; (dx,dy) points away from the entity."""
    s, sp = 13, 6.5
    if dx:
        bx = x + dx * s
        return (f'<path d="M {bx:.1f} {y:.1f} L {x:.1f} {y - sp:.1f} M {bx:.1f} {y:.1f} '
                f'L {x:.1f} {y:.1f} M {bx:.1f} {y:.1f} L {x:.1f} {y + sp:.1f}" '
                f'fill="none" stroke="{color}" stroke-width="1.6"/>')
    by = y + dy * s
    return (f'<path d="M {x:.1f} {by:.1f} L {x - sp:.1f} {y:.1f} M {x:.1f} {by:.1f} '
            f'L {x:.1f} {y:.1f} M {x:.1f} {by:.1f} L {x + sp:.1f} {y:.1f}" '
            f'fill="none" stroke="{color}" stroke-width="1.6"/>')

def tee(x, y, dx, dy, dist, color):
    half = 6.5
    cx, cy = x + dx * dist, y + dy * dist
    if dx:
        return (f'<line x1="{cx:.1f}" y1="{cy - half:.1f}" x2="{cx:.1f}" y2="{cy + half:.1f}" '
                f'stroke="{color}" stroke-width="1.6"/>')
    return (f'<line x1="{cx - half:.1f}" y1="{cy:.1f}" x2="{cx + half:.1f}" y2="{cy:.1f}" '
            f'stroke="{color}" stroke-width="1.6"/>')

def odot(x, y, dx, dy, dist, color):
    cx, cy = x + dx * dist, y + dy * dist
    return (f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="4.2" fill="#ffffff" '
            f'stroke="{color}" stroke-width="1.6"/>')

def draw_entity(name):
    x, y, g, sub, cols = ENT[name]
    border, head, tint, _ = GROUPS[g]
    h = box_h(name)
    o = [f'<g class="ent">']
    o.append(f'<rect x="{x}" y="{y}" width="{W}" height="{h}" rx="{R}" ry="{R}" '
             f'fill="#ffffff" stroke="{border}" stroke-width="1.6" filter="url(#shadow)"/>')
    o.append(f'<path d="M {x} {y + HEAD} L {x} {y + R} Q {x} {y} {x + R} {y} '
             f'L {x + W - R} {y} Q {x + W} {y} {x + W} {y + R} L {x + W} {y + HEAD} Z" '
             f'fill="{head}"/>')
    o.append(f'<text x="{x + W / 2}" y="{y + 19}" text-anchor="middle" fill="#ffffff" '
             f'font-size="14.5" font-weight="700">{esc(name)}</text>')
    o.append(f'<text x="{x + W / 2}" y="{y + 34}" text-anchor="middle" fill="{tint}" '
             f'font-size="9.5">{esc(sub)}</text>')
    for i, (key, col, typ, nullable) in enumerate(cols):
        ry = y + HEAD + i * ROW
        if i % 2 == 1:
            o.append(f'<rect x="{x + 1.5}" y="{ry}" width="{W - 3}" height="{ROW}" '
                     f'fill="#f8fafc"/>')
        ty = ry + 13.5
        if key:
            o.append(f'<text x="{x + 8}" y="{ty}" fill="{KEY_FILL[key]}" font-size="8"'
                     f' font-weight="700">{esc(key)}</text>')
        is_pk = key in (PK, PF)
        deco = ' text-decoration="underline"' if is_pk else ''
        weight = '700' if is_pk else '400'
        o.append(f'<text x="{x + 46}" y="{ty}" fill="#0f172a" font-size="10.5" '
                 f'font-weight="{weight}"{deco}>{esc(col)}</text>')
        t = esc(typ) + (" ?" if nullable else "")
        o.append(f'<text x="{x + W - 8}" y="{ty}" text-anchor="end" fill="#64748b" '
                 f'font-size="8.5">{t}</text>')
        if i:
            o.append(f'<line x1="{x + 1.5}" y1="{ry}" x2="{x + W - 1.5}" y2="{ry}" '
                     f'stroke="#e2e8f0" stroke-width="0.7"/>')
    o.append('</g>')
    return "\n".join(o)

def draw_edge(e, dashed=False):
    color = "#94a3b8" if dashed else "#5b6b80"
    pts = [e["start"]] + e["pts"] + [e["end"]]
    # pull the ends back so the cardinality marks have room
    (sx, sy), (sdx, sdy) = pts[0], e["pdir"]
    (ex, ey), (edx, edy) = pts[-1], e["cdir"]
    back_p = 26 if e.get("opt") else 19
    back_c = 13
    pts[0] = (sx + sdx * back_p, sy + sdy * back_p)
    pts[-1] = (ex + edx * back_c, ey + edy * back_c)
    dash = ' stroke-dasharray="7 5"' if dashed else ''
    o = [f'<path d="{rounded_path(pts)}" fill="none" stroke="{color}" '
         f'stroke-width="1.5"{dash} stroke-linejoin="round"/>']
    # parent side: "exactly one" or "zero or one"
    o.append(tee(sx, sy, sdx, sdy, 12, color))
    if e.get("opt"):
        o.append(odot(sx, sy, sdx, sdy, 21, color))
    # child side
    if e.get("one2one"):
        o.append(tee(ex, ey, edx, edy, 7, color))
        o.append(odot(ex, ey, edx, edy, 17, color))
    else:
        o.append(crow(ex, ey, edx, edy, color))
    if e.get("label"):
        lx, ly = e["lxy"]
        o.append(f'<text x="{lx}" y="{ly}" font-size="10" fill="#334155" '
                 f'style="paint-order:stroke" stroke="#ffffff" stroke-width="3.2" '
                 f'stroke-linejoin="round">{esc(e["label"])}</text>')
    return "\n".join(o)

def panel(x, y, w, title, rows, title_bg="#0f172a"):
    """A titled information panel; rows are (markup_fn, text) pairs."""
    rh = 20
    h = 34 + len(rows) * rh + 10
    o = [f'<g><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" ry="8" fill="#ffffff" '
         f'stroke="#cbd5e1" stroke-width="1.4" filter="url(#shadow)"/>',
         f'<path d="M {x} {y + 30} L {x} {y + 8} Q {x} {y} {x + 8} {y} L {x + w - 8} {y} '
         f'Q {x + w} {y} {x + w} {y + 8} L {x + w} {y + 30} Z" fill="{title_bg}"/>',
         f'<text x="{x + w / 2}" y="{y + 20}" text-anchor="middle" fill="#ffffff" '
         f'font-size="12.5" font-weight="700">{esc(title)}</text>']
    for i, (mark, text) in enumerate(rows):
        ry = y + 34 + i * rh + 14
        if callable(mark):
            o.append(mark(x + 30, ry - 4))
        elif mark:
            o.append(f'<text x="{x + 12}" y="{ry}" font-size="10" font-weight="700" '
                     f'fill="#1d4ed8">{esc(mark)}</text>')
        o.append(f'<text x="{x + 62}" y="{ry}" font-size="10.5" fill="#334155">{esc(text)}</text>')
    o.append('</g>')
    return "\n".join(o)

def build():
    CW, CH = 2700, 1620
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{CW}" height="{CH}" '
         f'viewBox="0 0 {CW} {CH}" font-family="DejaVu Sans, Inter, Segoe UI, sans-serif">',
         '<defs><filter id="shadow" x="-6%" y="-6%" width="115%" height="115%">'
         '<feDropShadow dx="0" dy="1.5" stdDeviation="2.2" flood-color="#0f172a" '
         'flood-opacity="0.13"/></filter></defs>',
         f'<rect width="{CW}" height="{CH}" fill="#ffffff"/>']

    o.append(f'<text x="{CW / 2}" y="86" text-anchor="middle" font-size="31" '
             f'font-weight="700" fill="#0f172a">'
             f'BUSIFY — Өгөгдлийн сангийн ER диаграм (ERD)</text>')
    o.append(f'<text x="{CW / 2}" y="116" text-anchor="middle" font-size="14.5" fill="#475569">'
             f'Автобусны буудал дээр сэрээх систем · Захиалагч: 6-р баг · '
             f'Хөгжүүлэгч: 2-р баг</text>')
    o.append(f'<text x="{CW / 2}" y="139" text-anchor="middle" font-size="12" fill="#64748b">'
             f'Эх сурвалж: server/prisma/schema.prisma (SQLite, Prisma ORM) · '
             f'17 хүснэгт · 23 холбоо</text>')
    o.append(f'<line x1="{CW / 2 - 420}" y1="158" x2="{CW / 2 + 420}" y2="158" '
             f'stroke="#cbd5e1" stroke-width="1.2"/>')

    for gx, gy, g, text in [
        (60, 586, "auth", "ХЭРЭГЛЭГЧ, ДҮР, ЭРХИЙН УДИРДЛАГА"),
        (700, 228, "auth", "СЕСС БА ТОХИРГОО"),
        (1060, 536, "journey", "АЯЛАЛ БА СЭРЭМЖЛҮҮЛЭГ"),
        (1420, 474, "route", "МАРШРУТ БА БУУДАЛ"),
        (2070, 452, "support", "ХАРИЛЦАГЧИЙН ҮЙЛЧИЛГЭЭ"),
        (60, 1252, "ops", "ЛОГ, МЭДЭГДЭЛ, СИСТЕМИЙН ТОХИРГОО"),
    ]:
        c = GROUPS[g][0]
        o.append(f'<rect x="{gx}" y="{gy - 13}" width="7" height="14" rx="2" fill="{c}"/>')
        o.append(f'<text x="{gx + 14}" y="{gy}" font-size="12.5" font-weight="700" '
                 f'fill="{c}" letter-spacing="0.4">{esc(text)}</text>')

    for e in EDGES:
        o.append(draw_edge(e))
    for e in SOFT_EDGES:
        o.append(draw_edge(e, dashed=True))
    for name in ENT:
        o.append(draw_entity(name))

    gray = "#5b6b80"
    one   = lambda x, y: tee(x + 26, y, -1, 0, 8, gray) + \
        f'<line x1="{x - 4}" y1="{y}" x2="{x + 26}" y2="{y}" stroke="{gray}" stroke-width="1.5"/>'
    zone  = lambda x, y: tee(x + 26, y, -1, 0, 6, gray) + odot(x + 26, y, -1, 0, 15, gray) + \
        f'<line x1="{x - 4}" y1="{y}" x2="{x + 26}" y2="{y}" stroke="{gray}" stroke-width="1.5"/>'
    many  = lambda x, y: crow(x + 26, y, -1, 0, gray) + \
        f'<line x1="{x - 4}" y1="{y}" x2="{x + 13}" y2="{y}" stroke="{gray}" stroke-width="1.5"/>'

    o.append(panel(60, 200, 566, "ЗАГВАРЫН ҮНДСЭН ДҮРМҮҮД", [
        ("1.", "Зорчигч нэг үед зөвхөн нэг нээлттэй (ACTIVE/PAUSED) Journey-тэй:"),
        ("",  "    шинийг эхлүүлэхэд хуучин нь CANCELLED (REPLACED) болно."),
        ("2.", "Journey нь маршрут, буудлын утгыг хуулбарлан хадгална"),
        ("",  "    (routeNumber, destinationLat/Lng) — түүх хэвээр үлдэнэ."),
        ("3.", "Role ↔ Permission нь N:M — RolePermission задалсан хүснэгт."),
        ("4.", "User.passwordHash нь bcrypt, Session.id нь SHA-256 хэш."),
        ("5.", "Маршрут/буудал устахад Journey.routeId = NULL болно"),
        ("",  "    (ON DELETE SET NULL), харин User устахад Journey устана."),
    ], title_bg="#1d4ed8"))

    o.append(panel(1450, 1190, 560, "ТЭМДЭГЛЭГЭЭ (Crow’s foot)", [
        ("PK", "Үндсэн түлхүүр — доогуур зураастай, тод"),
        ("FK", "Гадаад түлхүүр (өөр хүснэгт рүү заана)"),
        ("UQ", "Давхардахгүй утга (unique)"),
        ("?",  "NULL утга зөвшөөрнө (заавал биш)"),
        ("~",  "Логик холбоо — өгөгдлийн санд FK биш (тасархай)"),
        (one,  "Яг нэг бичлэг (1)"),
        (zone, "Тэг эсвэл нэг бичлэг (0..1)"),
        (many, "Тэг ба түүнээс олон бичлэг (0..N)"),
    ]))

    o.append(panel(2060, 1190, 600, "ENUM (тогтмол утгууд)", [
        ("", "UserStatus: ACTIVE · SUSPENDED"),
        ("", "RouteStatus: ACTIVE · INACTIVE · DRAFT"),
        ("", "JourneyStatus: ACTIVE · PAUSED · COMPLETED · CANCELLED"),
        ("", "TicketStatus: OPEN · IN_PROGRESS · RESOLVED"),
        ("", "TicketCategory: COMPLAINT · FEEDBACK · QUESTION ·"),
        ("", "        APP_PROBLEM · ROUTE_DATA"),
        ("", "TicketPriority: LOW · NORMAL · HIGH · URGENT"),
        ("", "TicketEventType: CREATED · STATUS_CHANGED ·"),
        ("", "        PRIORITY_CHANGED · ASSIGNED · RESPONSE_ADDED ·"),
        ("", "        INTERNAL_NOTE · ESCALATED · REOPENED"),
        ("", "ErrorSource: SERVER · CLIENT"),
    ], title_bg="#475569"))

    o.append('</svg>')
    return "\n".join(o)

if __name__ == "__main__":
    print(build())
