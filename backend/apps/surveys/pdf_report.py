   
import io
import os
from xml.sax.saxutils import escape

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
    Table, TableStyle, KeepTogether, Flowable,
)

import arabic_reshaper
from bidi.algorithm import get_display


_FONT_DIR = os.path.join(os.path.dirname(__file__), 'assets', 'fonts')
_FONTS_READY = False


def _ensure_fonts():
    global _FONTS_READY
    if _FONTS_READY:
        return
    pdfmetrics.registerFont(TTFont('Vazir', os.path.join(_FONT_DIR, 'Vazirmatn-Regular.ttf')))
    pdfmetrics.registerFont(TTFont('Vazir-Bold', os.path.join(_FONT_DIR, 'Vazirmatn-Bold.ttf')))
    pdfmetrics.registerFontFamily('Vazir', normal='Vazir', bold='Vazir-Bold')
    _FONTS_READY = True


_reshaper = arabic_reshaper.ArabicReshaper(
    configuration={'delete_harakat': False, 'support_ligatures': True}
)

_FA_DIGITS = str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹')


def _fa_num(n, d=0):
    """Format a number with Persian digits. ``None`` -> em dash."""
    if n is None:
        return '—'
    if isinstance(n, float):
        s = f'{n:.{d}f}' if d else f'{round(n)}'
    else:
        s = str(n)
    return s.translate(_FA_DIGITS)


def _rtl(text):
    """Reshape + bidi-reorder a Persian/mixed string for correct RTL output.

    Use this for text drawn directly on the canvas (header band, footer) where
    no XML parsing happens.
    """
    if text is None:
        return ''
    return get_display(_reshaper.reshape(str(text)))


def _rtlp(text):
    """RTL text for ReportLab ``Paragraph`` flowables.

    ``Paragraph`` parses its input as mini-XML, so raw ``&``, ``<`` and ``>``
    (common in free-text comments, e.g. "سود > ۵۰" or "A&B") would raise a
    parse error and crash PDF generation. We reshape/reorder first, then escape
    last so the escaped entities are never reordered by the bidi algorithm.
    """
    return escape(_rtl(text))


def _score_palette(v):
    if v is None:
        return colors.HexColor('#94a3b8'), colors.HexColor('#f8fafc')
    if v < 4:
        return colors.HexColor('#ef4444'), colors.HexColor('#fef2f2')
    if v < 7:
        return colors.HexColor('#f59e0b'), colors.HexColor('#fffbeb')
    return colors.HexColor('#10b981'), colors.HexColor('#f0fdf4')


_EMOJI_PALETTE = {
    'bad':       (colors.HexColor('#ef4444'), colors.HexColor('#fef2f2')),
    'average':   (colors.HexColor('#f59e0b'), colors.HexColor('#fffbeb')),
    'good':      (colors.HexColor('#84cc16'), colors.HexColor('#f7fee7')),
    'excellent': (colors.HexColor('#10b981'), colors.HexColor('#f0fdf4')),
}


def _emoji_palette(key):
    return _EMOJI_PALETTE.get(key, (colors.HexColor('#94a3b8'), colors.HexColor('#f8fafc')))


_EMOJI_LABEL_TO_KEY = {'ضعیف': 'bad', 'بد': 'bad', 'متوسط': 'average', 'خوب': 'good', 'عالی': 'excellent'}


def _score_grade(v):
    if v is None:
        return '—'
    if v < 4:
        return 'ضعیف'
    if v < 6:
        return 'متوسط'
    if v < 8:
        return 'خوب'
    return 'عالی'


_INK = colors.HexColor('#1e293b')
_SLATE = colors.HexColor('#64748b')
_LIGHT = colors.HexColor('#e2e8f0')
_BRAND = colors.HexColor('#4f46e5')
_ALT_ROW = colors.HexColor('#f8fafc')
_COPYRIGHT_NOTICE = 'Built by nothingnessdev'


class _GradientBand(Flowable):
    """Rounded-feel header band with an indigo→violet gradient and titles."""

    def __init__(self, width, height, title, subtitle):
        super().__init__()
        self.width = width
        self.height = height
        self.title = title
        self.subtitle = subtitle

    def draw(self):
        c = self.canv
        steps = 60
        for i in range(steps):
            t = i / (steps - 1)
            r = 0x4f + (0x7c - 0x4f) * t
            g = 0x46 + (0x3a - 0x46) * t
            b = 0xe5 + (0xed - 0xe5) * t
            c.setFillColorRGB(r / 255, g / 255, b / 255)
            c.rect(self.width * i / steps, 0, self.width / steps + 1, self.height,
                   stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont('Vazir-Bold', 20)
        c.drawCentredString(self.width / 2, self.height - 30, _rtl(self.title))
        c.setFont('Vazir', 11)
        c.drawCentredString(self.width / 2, self.height - 52, _rtl(self.subtitle))


def build_survey_pdf(survey, results, questions_meta, comment_groups, summary,
                     comments_truncated=False, custom_sections=None):
    """Build the survey results PDF and return it as bytes.

    Args:
        survey: the Survey instance (uses ``.title``).
        results: list of result dicts from ``calculate_survey_results``.
        questions_meta: list of dicts with keys
            ``text, avg, responses, comments, has_score, has_comment`` for the
            shared/general question set only (particular persons excluded).
        comment_groups: list of dicts (one per question with comments):
            ``{question, items: [(person, dept, comment)], total, extra}``.
            ``extra`` is how many comments were omitted for brevity.
        summary: dict with keys
            ``overall_avg, questions, people, voters, distribution`` where
            ``distribution`` is a list of ``(label, count, hex_color)``.
        comments_truncated: True if any comments were omitted across the report.
        custom_sections: optional list of dicts, one per particular person,
            each with ``{title, questions_meta, comment_groups, truncated}`` -
            rendered as fully isolated blocks after the shared report, never
            compared against the shared results or each other.
    """
    _ensure_fonts()

    buf = io.BytesIO()
    page_w, page_h = A4
    margin = 14 * mm
    doc = BaseDocTemplate(
        buf, pagesize=A4,
        leftMargin=margin, rightMargin=margin, topMargin=14 * mm, bottomMargin=16 * mm,
        title=f'نتایج نظرسنجی: {survey.title}',
    )
    frame = Frame(margin, 16 * mm, page_w - 2 * margin, page_h - 30 * mm, id='main')

    def _footer(canvas, _doc):
        canvas.saveState()
        canvas.setFont('Vazir', 8)
        canvas.setFillColor(_SLATE)
        canvas.drawCentredString(
            page_w / 2, 9 * mm,
            _COPYRIGHT_NOTICE,
        )
        canvas.setStrokeColor(_LIGHT)
        canvas.setLineWidth(0.5)
        canvas.line(margin, 13 * mm, page_w - margin, 13 * mm)
        canvas.restoreState()

    doc.addPageTemplates([PageTemplate(id='all', frames=[frame], onPage=_footer)])

    styles = {
        'h2': ParagraphStyle('h2', fontName='Vazir-Bold', fontSize=13, textColor=_INK,
                             alignment=TA_RIGHT, spaceBefore=14, spaceAfter=8, leading=18),
        'body': ParagraphStyle('body', fontName='Vazir', fontSize=9.5, textColor=_INK,
                               alignment=TA_RIGHT, leading=15),
        'cell': ParagraphStyle('cell', fontName='Vazir', fontSize=8.5, textColor=_INK,
                               alignment=TA_RIGHT, leading=12),
        'cellc': ParagraphStyle('cellc', fontName='Vazir', fontSize=8.5, textColor=_INK,
                                alignment=TA_CENTER, leading=12),
        'th': ParagraphStyle('th', fontName='Vazir-Bold', fontSize=8.5, textColor=colors.white,
                             alignment=TA_CENTER, leading=12),
        'muted': ParagraphStyle('muted', fontName='Vazir', fontSize=8, textColor=_SLATE,
                                alignment=TA_RIGHT, leading=12),
    }

    def P(text, style='body'):
        return Paragraph(_rtlp(text), styles[style])

    content_w = page_w - 2 * margin
    story = []

    story.append(_GradientBand(content_w, 78, survey.title, 'گزارش تحلیلی نتایج نظرسنجی'))
    story.append(Spacer(1, 14))

    def _kpi(label, value, accent):
        inner = Table(
            [[Paragraph(_rtlp(value), ParagraphStyle(
                'kv', fontName='Vazir-Bold', fontSize=17, textColor=accent, alignment=TA_CENTER))],
             [Paragraph(_rtlp(label), ParagraphStyle(
                'kl', fontName='Vazir', fontSize=8.5, textColor=_SLATE, alignment=TA_CENTER))]],
            rowHeights=[26, 16])
        inner.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        return inner

    avg = summary['overall_avg']
    avg_accent, _ = _score_palette(avg)
    cards = [
        _kpi('میانگین کل', _fa_num(avg, 2) if avg is not None else '—', avg_accent),
        _kpi('سوالات فعال', _fa_num(summary['questions']), _BRAND),
        _kpi('افراد ارزیابی‌شونده', _fa_num(summary['people']), _BRAND),
        _kpi('رأی‌دهندگان کامل', _fa_num(summary['voters']), _BRAND),
    ]
    kpi_table = Table([cards], colWidths=[content_w / 4] * 4)
    kpi_table.setStyle(TableStyle([
        ('BOX', (0, 0), (0, 0), 0.8, _LIGHT),
        ('BOX', (1, 0), (1, 0), 0.8, _LIGHT),
        ('BOX', (2, 0), (2, 0), 0.8, _LIGHT),
        ('BOX', (3, 0), (3, 0), 0.8, _LIGHT),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fbfcfe')),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(kpi_table)

    distribution = summary.get('distribution') or []
    if distribution:
        story.append(P('توزیع امتیازات', 'h2'))
        total = sum(d[1] for d in distribution) or 1
        rows = []
        for label, count, col in distribution:
            pct = count / total
            bar = Table([['']], colWidths=[max(2, pct * (content_w * 0.5))], rowHeights=[12])
            bar.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(col)),
                ('LINEBELOW', (0, 0), (-1, -1), 0, colors.white),
            ]))
            rows.append([
                Paragraph(_rtlp(f'{_fa_num(count)} نفر ({_fa_num(pct * 100)}٪)'), styles['muted']),
                bar,
                Paragraph(_rtlp(label), styles['cell']),
            ])
        dist_table = Table(rows, colWidths=[content_w * 0.22, content_w * 0.55, content_w * 0.23])
        dist_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(dist_table)

    emoji_distribution = summary.get('emoji_distribution') or []
    if emoji_distribution:
        story.append(P('توزیع امتیاز ایموجی', 'h2'))
        emoji_total = sum(d[1] for d in emoji_distribution) or 1
        emoji_rows = []
        for label, count, col in emoji_distribution:
            pct = count / emoji_total
            bar = Table([['']], colWidths=[max(2, pct * (content_w * 0.5))], rowHeights=[12])
            bar.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(col)),
                ('LINEBELOW', (0, 0), (-1, -1), 0, colors.white),
            ]))
            emoji_rows.append([
                Paragraph(_rtlp(f'{_fa_num(count)} پاسخ ({_fa_num(pct * 100)}٪)'), styles['muted']),
                bar,
                Paragraph(_rtlp(label), styles['cell']),
            ])
        emoji_dist_table = Table(emoji_rows, colWidths=[content_w * 0.22, content_w * 0.55, content_w * 0.23])
        emoji_dist_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(emoji_dist_table)

    story.append(P('رتبه‌بندی افراد', 'h2'))

    # People with the full default question set and people with a custom/partial
    # question set are rendered as separate tables under their own heading - never
    # mixed into the same table - and each custom person gets their own table.
    all_group = [r for r in results if r.get('result_section') == 'all' or not r.get('result_section')]
    custom_groups = [
        (r['full_name'], [r]) for r in results if str(r.get('result_section', '')).startswith('custom:')
    ]
    rank_groups = ([('افراد دارای همه سوال‌ها', all_group)] if all_group else []) + custom_groups

    def _rank_table(group_results):
        header = [P('رتبه', 'th'), P('نام و نام خانوادگی', 'th'), P('واحد', 'th'),
                  P('سمت', 'th'), P('میانگین', 'th'), P('کیفیت', 'th'), P('رأی', 'th')]
        data = [header]
        style_cmds = [
            ('BACKGROUND', (0, 0), (-1, 0), _INK),
            ('GRID', (0, 0), (-1, -1), 0.4, _LIGHT),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, _ALT_ROW]),
        ]
        for r in group_results:
            av = r['average_score']
            fg, bg = _score_palette(av)
            data.append([
                Paragraph(_rtlp(_fa_num(r['rank'])), styles['cellc']),
                Paragraph(_rtlp(r['full_name']), styles['cell']),
                Paragraph(_rtlp(r.get('department') or '—'), styles['cell']),
                Paragraph(_rtlp(r.get('role_title') or '—'), styles['cell']),
                Paragraph(_rtlp(_fa_num(av, 2) if av is not None else '—'),
                          ParagraphStyle('sc', parent=styles['cellc'], textColor=fg, fontName='Vazir-Bold')),
                Paragraph(_rtlp(_score_grade(av)),
                          ParagraphStyle('g', parent=styles['cellc'], textColor=fg)),
                Paragraph(_rtlp(_fa_num(r['votes_count'])), styles['cellc']),
            ])
            ri = len(data) - 1
            style_cmds.append(('BACKGROUND', (4, ri), (4, ri), bg))
        table = Table(
            data,
            colWidths=[content_w * x for x in (0.09, 0.26, 0.17, 0.16, 0.13, 0.11, 0.08)],
            repeatRows=1,
        )
        table.setStyle(TableStyle(style_cmds))
        return table

    for title, group_results in rank_groups:
        story.append(P(title, 'muted'))
        story.append(Spacer(1, 4))
        story.append(_rank_table(group_results))
        story.append(Spacer(1, 10))

    def _questions_table(meta_list):
        qheader = [P('#', 'th'), P('متن سوال', 'th'), P('میانگین کل', 'th'),
                   P('تعداد پاسخ', 'th'), P('امتیاز ایموجی', 'th'), P('نظرات متنی', 'th')]
        qdata = [qheader]
        qstyle = [
            ('BACKGROUND', (0, 0), (-1, 0), _INK),
            ('GRID', (0, 0), (-1, -1), 0.4, _LIGHT),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, _ALT_ROW]),
        ]
        for idx, q in enumerate(meta_list, 1):
            av = q['avg']
            fg, bg = _score_palette(av)
            emoji_label = q.get('emoji_avg_label')
            has_emoji_value = bool(q.get('has_emoji') and emoji_label)
            emoji_fg, emoji_bg = _emoji_palette(_EMOJI_LABEL_TO_KEY.get(emoji_label))
            emoji_cell_style = ParagraphStyle('qem', parent=styles['cellc'], textColor=emoji_fg, fontName='Vazir-Bold')
            qdata.append([
                Paragraph(_rtlp(_fa_num(idx)), styles['cellc']),
                Paragraph(_rtlp(q['text']), styles['cell']),
                Paragraph(_rtlp(_fa_num(av, 2) if av is not None else 'متنی'),
                          ParagraphStyle('qsc', parent=styles['cellc'], textColor=fg, fontName='Vazir-Bold')),
                Paragraph(_rtlp(_fa_num(q['responses']) if q['has_score'] else '—'), styles['cellc']),
                Paragraph(_rtlp(emoji_label) if has_emoji_value else _rtlp('—'), emoji_cell_style if has_emoji_value else styles['cellc']),
                Paragraph(_rtlp(_fa_num(q['comments']) if q['has_comment'] else '—'), styles['cellc']),
            ])
            ri = len(qdata) - 1
            if av is not None:
                qstyle.append(('BACKGROUND', (2, ri), (2, ri), bg))
            if has_emoji_value:
                qstyle.append(('BACKGROUND', (4, ri), (4, ri), emoji_bg))
        qtable = Table(
            qdata,
            colWidths=[content_w * x for x in (0.06, 0.40, 0.14, 0.12, 0.14, 0.14)],
            repeatRows=1,
        )
        qtable.setStyle(TableStyle(qstyle))
        return qtable

    def _render_comments(groups, truncated):
        if not groups:
            return
        total_all = sum(g['total'] for g in groups)
        shown_all = sum(len(g['items']) for g in groups)
        heading = 'نظرات متنی'
        if total_all:
            heading += f'  ({_fa_num(shown_all)} از {_fa_num(total_all)})'
        story.append(P(heading, 'h2'))

        if truncated:
            note = Paragraph(
                _rtl('برای مشاهدهٔ فهرست کامل نظرات، خروجی اکسل یا CSV را دانلود کنید.'),
                ParagraphStyle('cm_note', fontName='Vazir', fontSize=8, textColor=_SLATE,
                               alignment=TA_RIGHT, leading=12, spaceAfter=6))
            story.append(note)

        for group in groups:
            q_title = Paragraph(
                _rtl(f"{group['question']}  ·  {_fa_num(group['total'])} نظر"),
                ParagraphStyle('cm_q', fontName='Vazir-Bold', fontSize=9.5, textColor=_INK,
                               alignment=TA_RIGHT, leading=14, spaceBefore=8, spaceAfter=4))
            story.append(q_title)

            for person_name, dept, comment in group['items']:
                block = Table([
                    [Paragraph(_rtlp(f"{person_name}{(' · ' + dept) if dept else ''}"),
                               ParagraphStyle('cm_h', fontName='Vazir-Bold', fontSize=8.5,
                                              textColor=_BRAND, alignment=TA_RIGHT))],
                    [Paragraph(_rtlp('«' + comment + '»'), styles['cell'])],
                ], colWidths=[content_w])
                block.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), _ALT_ROW),
                    ('BOX', (0, 0), (-1, -1), 0.5, _LIGHT),
                    ('LINEBEFORE', (0, 0), (0, -1), 2.5, _BRAND),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                    ('TOPPADDING', (0, 0), (-1, -1), 3),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ]))
                story.append(KeepTogether([block, Spacer(1, 5)]))

            if group['extra'] > 0:
                story.append(Paragraph(
                    _rtl(f"+ {_fa_num(group['extra'])} نظر دیگر برای این سوال"),
                    ParagraphStyle('cm_more', fontName='Vazir', fontSize=8, textColor=_SLATE,
                                   alignment=TA_RIGHT, leading=12, spaceAfter=4)))

    story.append(P('تحلیل سوال‌به‌سوال', 'h2'))
    story.append(_questions_table(questions_meta))
    _render_comments(comment_groups, comments_truncated)

    # Each particular person gets a fully isolated block - their own question
    # analysis and comments - never merged into the shared tables above.
    for section in (custom_sections or []):
        story.append(Spacer(1, 14))
        story.append(P(section['title'], 'h2'))
        if section.get('questions_meta'):
            story.append(_questions_table(section['questions_meta']))
        _render_comments(section.get('comment_groups') or [], section.get('truncated', False))

    doc.build(story)
    return buf.getvalue()
