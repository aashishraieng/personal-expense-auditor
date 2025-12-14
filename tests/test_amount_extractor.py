# tests/test_amount_extractor.py
from expense_auditor.utils.amount_extractor import extract_amount



def test_rupee_symbol():
    assert extract_amount("₹1,250 debited from your account") == 1250.0


def test_rs_prefix():
    assert extract_amount("Rs. 499.50 paid to Amazon") == 499.50


def test_rs_suffix():
    assert extract_amount("Amount 750 rs credited") == 750.0


def test_no_amount():
    assert extract_amount("OTP for login is 123456") is None
