from app.scripts.import_serial_capture import parse_serial_samples


def test_parse_serial_samples_keeps_only_six_column_csv_rows():
    text = """
INDEX | RAW=1789 | SMOOTH=1810 | FLAT=1905 | CURL=1758
1792,1807,66,1975,1978,1
------------------------------------------------------------
1758,1801,70,2090,1987,0
bad,line
1813,1805,68,2028,1998,0
"""

    assert parse_serial_samples(text) == [
        [1792.0, 1807.0, 66.0, 1975.0, 1978.0, 1.0],
        [1758.0, 1801.0, 70.0, 2090.0, 1987.0, 0.0],
        [1813.0, 1805.0, 68.0, 2028.0, 1998.0, 0.0],
    ]
