"""
Generates data/conjugations.json from scripts/raw_table.txt.

raw_table.txt is a near-literal transcription of the auxiliary verb
conjugation table (izan/ukan) from http://euskaljakintzaaditza.weebly.com/.
Only the standard (non-hitano) form per cell is kept: hitano continuation
lines (the indented variants with no leading person label, e.g. "naiz" /
"nauk" / "naun") are skipped automatically because they don't start with a
recognized person word.

Blocked cells (a person combination that doesn't exist, e.g. "ni...niri")
are simply absent from a row in the source; this script re-associates each
present value to the correct column person using a verified rule: a cell is
blocked exactly when the two persons are identical, or both belong to
{ni, gu}, or both belong to {hi, zu, zuek}. Third person (hura/haiek) never
blocks. Agintera additionally excludes {ni, gu} as the "commanded" role
entirely (you can't order yourself), matching rows missing from the source.
"""
import json
import os

NOR_LABELS = ["ni", "hi", "hura", "gu", "zu", "zuek", "haiek"]
NORI_LABELS = ["niri", "hiri", "hari", "guri", "zuri", "zuei", "haiei"]
NORK_LABELS = ["nik", "hik", "hark", "guk", "zuk", "zuek", "haiek"]

BASE_OF = {}
for label_set, bases in ((NOR_LABELS, NOR_LABELS), (NORI_LABELS, NOR_LABELS), (NORK_LABELS, NOR_LABELS)):
    for label, base in zip(label_set, bases):
        BASE_OF[label] = base

GROUP_NI_GU = {"ni", "gu"}
GROUP_HI_ZU_ZUEK = {"hi", "zu", "zuek"}


def blocked(p1, p2):
    # 3rd person (hura/haiek) never blocks, even against itself (e.g. hura-hari is valid).
    # 1st/2nd person self-overlap is fully captured by the group membership checks below
    # (e.g. ni-ni is blocked because both are in GROUP_NI_GU).
    b1, b2 = BASE_OF[p1], BASE_OF[p2]
    if b1 in GROUP_NI_GU and b2 in GROUP_NI_GU:
        return True
    if b1 in GROUP_HI_ZU_ZUEK and b2 in GROUP_HI_ZU_ZUEK:
        return True
    return False


MOTA_HEADERS = {
    "NOR": "nor",
    "NOR-NORI": "nor-nori",
    "NOR-NORK": "nor-nork",
    "NOR(sg)-NORI-NORK": "nor-sg-nori-nork",
    "NOR(pl)-NORI-NORK": "nor-pl-nori-nork",
}

MODUA_HEADERS = {
    "INDIKATIBOA": ("indikatiboa", None),
    "BALDINTZA": ("baldintza", None),
    "ONDORIOA-ORAIN": ("ondorioa", "orain"),
    "ONDORIOA-LEHEN": ("ondorioa", "lehen"),
    "AHALERA / POTENTZIALA": ("ahalera", None),
    "HIPOTETIKOA": ("hipotetikoa", None),
    "SUBJUNTIBOA": ("subjuntiboa", None),
    "AGINTERA": ("agintera", None),
}

MODUA_WITHOUT_ALDIA = {"baldintza", "hipotetikoa", "agintera"}

ROW_LABELS_FOR_MOTA = {
    "nor-nori": NOR_LABELS,
    "nor-nork": NORK_LABELS,
    "nor-sg-nori-nork": NORK_LABELS,
    "nor-pl-nori-nork": NORK_LABELS,
}
COLUMN_LABELS_FOR_MOTA = {
    "nor-nori": NORI_LABELS,
    "nor-nork": NOR_LABELS,
    "nor-sg-nori-nork": NORI_LABELS,
    "nor-pl-nori-nork": NORI_LABELS,
}
ROLE_NAME_FOR_MOTA = {
    "nor-nori": ("nor", "nori"),
    "nor-nork": ("nork", "nor"),
    "nor-sg-nori-nork": ("nork", "nori"),
    "nor-pl-nori-nork": ("nork", "nori"),
}


def parse_raw_table(path):
    """Returns a list of captured rows: dicts with mota, modua, aldia, row_label, values."""
    captured = []
    modua = aldia = mota = None
    nor_row_captured = False

    with open(path, encoding="utf-8") as f:
        for lineno, raw_line in enumerate(f, start=1):
            line = raw_line.strip()
            if not line:
                continue

            if line in MODUA_HEADERS:
                modua, forced_aldia = MODUA_HEADERS[line]
                aldia = forced_aldia
                mota = None
                continue

            if line == "ORAIN":
                aldia = "orain"
                continue
            if line == "LEHEN":
                aldia = "lehen"
                continue

            if line in MOTA_HEADERS:
                mota = MOTA_HEADERS[line]
                nor_row_captured = False
                continue

            tokens = line.split()

            if tokens == NOR_LABELS or tokens == NORI_LABELS or tokens == NORK_LABELS:
                continue  # column header line, not data

            if mota is None:
                raise ValueError(f"line {lineno}: data line before any mota header: {line!r}")

            if mota == "nor":
                if nor_row_captured:
                    continue  # hitano continuation line, skip
                captured.append({
                    "mota": mota, "modua": modua, "aldia": aldia,
                    "row_label": None, "values": tokens,
                })
                nor_row_captured = True
                continue

            row_labels = ROW_LABELS_FOR_MOTA[mota]
            if tokens[0] in row_labels:
                captured.append({
                    "mota": mota, "modua": modua, "aldia": aldia,
                    "row_label": tokens[0], "values": tokens[1:],
                })
            # else: hitano continuation line (no recognized row label), skip

    return captured


def build_conjugations(captured):
    data = {}

    for row in captured:
        mota, modua, aldia = row["mota"], row["modua"], row["aldia"]
        if modua in MODUA_WITHOUT_ALDIA:
            aldia = None

        if mota == "nor":
            if modua == "agintera":
                valid_cols = [c for c in NOR_LABELS if BASE_OF[c] not in GROUP_NI_GU]
            else:
                valid_cols = NOR_LABELS
            values = row["values"]
            assert len(values) == len(valid_cols), (
                f"nor/{modua}: expected {len(valid_cols)} forms, got {len(values)}: {values}"
            )
            entries = [{"nor": col, "form": form} for col, form in zip(valid_cols, values)]
        else:
            row_person = row["row_label"]
            role_row, role_col = ROLE_NAME_FOR_MOTA[mota]
            col_labels = COLUMN_LABELS_FOR_MOTA[mota]
            valid_cols = [c for c in col_labels if not blocked(row_person, c)]
            values = row["values"]
            assert len(values) == len(valid_cols), (
                f"{mota}/{modua}/{aldia}/{row_person}: expected {len(valid_cols)} forms "
                f"({valid_cols}), got {len(values)}: {values}"
            )
            entries = [{role_row: row_person, role_col: col, "form": form}
                       for col, form in zip(valid_cols, values)]

        bucket = data.setdefault(mota, {}).setdefault(modua, {} if aldia else [])
        if aldia:
            bucket.setdefault(aldia, []).extend(entries)
        else:
            bucket.extend(entries)

    return data


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    raw_path = os.path.join(here, "raw_table.txt")
    out_path = os.path.join(here, "..", "data", "conjugations.json")

    captured = parse_raw_table(raw_path)
    print(f"Parsed {len(captured)} rows from raw_table.txt")

    data = build_conjugations(captured)

    total_forms = 0

    def count(node):
        nonlocal total_forms
        if isinstance(node, list):
            total_forms += len(node)
        else:
            for v in node.values():
                count(v)

    count(data)
    print(f"Generated {total_forms} conjugated forms")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
