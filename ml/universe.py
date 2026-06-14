"""BIST 100 alt-evreni — ml pipeline'ının paylaşılan sembol listesi.
Web app'teki lib/universe.ts BIST_UNIVERSE ile aynı 26 likit hisse."""

BIST_TICKERS = [
    ("THYAO", "Turk Hava Yollari"),
    ("GARAN", "Garanti BBVA"),
    ("AKBNK", "Akbank"),
    ("ISCTR", "Is Bankasi C"),
    ("YKBNK", "Yapi Kredi"),
    ("BIMAS", "BIM"),
    ("ASELS", "Aselsan"),
    ("KCHOL", "Koc Holding"),
    ("SAHOL", "Sabanci Holding"),
    ("EREGL", "Eregli Demir Celik"),
    ("TUPRS", "Tupras"),
    ("FROTO", "Ford Otosan"),
    ("TOASO", "Tofas"),
    ("SISE", "Sisecam"),
    ("PETKM", "Petkim"),
    ("KOZAL", "Koza Altin"),
    ("PGSUS", "Pegasus"),
    ("TCELL", "Turkcell"),
    ("TTKOM", "Turk Telekom"),
    ("SASA", "Sasa Polyester"),
    ("ENKAI", "Enka Insaat"),
    ("TAVHL", "TAV Havalimanlari"),
    ("MGROS", "Migros"),
    ("ARCLK", "Arcelik"),
    ("GUBRF", "Gubre Fabrikalari"),
    ("HEKTS", "Hektas"),
]

# Yahoo sembolü (.IS soneki)
def yahoo_symbol(code: str) -> str:
    return f"{code}.IS"
