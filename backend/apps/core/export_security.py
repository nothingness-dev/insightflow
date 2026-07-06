"""Helpers to keep user-supplied text safe when written into CSV/Excel exports."""

_FORMULA_TRIGGER_CHARS = ('=', '+', '-', '@', '\t', '\r')


def sanitize_cell(value):
    """Neutralize spreadsheet formula injection (CSV/Excel, CWE-1236).

    Values that start with a formula-trigger character are prefixed with a
    single quote so Excel/LibreOffice/Google Sheets render them as plain
    text instead of evaluating them as a formula.
    """
    if value is None:
        return ''
    text = value if isinstance(value, str) else str(value)
    if text.startswith(_FORMULA_TRIGGER_CHARS):
        return "'" + text
    return text
