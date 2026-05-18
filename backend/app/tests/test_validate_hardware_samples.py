from pathlib import Path

from app.scripts.validate_hardware_samples import validate_label


def test_validate_label_counts_clean_and_rejected_rows(tmp_path: Path):
    sample_file = tmp_path / "index_bent.txt"
    sample_file.write_text(
        "\n".join(
            [
                "1839,1839,100,1985,1988,0",
                "1840,1840,98,1996,1987,0",
                "1924,1907,4,1992,1999,0",
            ]
        ),
        encoding="utf-8",
    )

    result = validate_label("INDEX_BENT", sample_file)

    assert result["rows"] == 3
    assert result["clean_rows"] == 2
    assert result["rejected_rows"] == 1
    assert result["ready"] is False
