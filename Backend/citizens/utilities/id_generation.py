import hmac
import hashlib
import base64
import os
from xmlrpc.client import DateTime

from django.core.signing import base64_hmac

CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
SECRET_KEY = os.getenv("DIN_SECRET_KEY")

def char_to_value(char: str) -> int:
    return CHARSET.index(char)

def value_to_char(value: int) -> str:
    return CHARSET[value]

def create_check_sum(generated_id):
    total = 0
    for i, char in enumerate(reversed(generated_id)):
        value = char_to_value(char)
        if i % 2 == 1:
            value *= 2
            if value > 35:
                value -= 35
        total += value
    check_value = (36 - (total % 36)) % 36
    return value_to_char(check_value)

def generate_id(seed: bytes,type: str):
    if not isinstance(seed, bytes):
        raise ValueError("Seed must be in bytes")

    if not SECRET_KEY:
        raise EnvironmentError("DIN Secret Key was not found in environment")

    mac = hmac.new(
        key = SECRET_KEY.encode('utf-8'),
        msg = seed,
        digestmod = hashlib.sha256
    )

    base64_hmac_encoding = base64.urlsafe_b64encode(mac.digest()).decode("utf-8").upper()

    filtered_id = "".join(char for char in base64_hmac_encoding if char in CHARSET)

    if len(filtered_id) < 12:
        raise ValueError("Filtered ID too short")

    final_hmac_id = filtered_id[:12]

    check_sum_value = create_check_sum(final_hmac_id)

    if type == "CITIZEN":
        return f"ZM-{final_hmac_id}{check_sum_value}"
    elif type == "THIRD_PARTY":
        return f"TP-{final_hmac_id}{check_sum_value}"
    else:
        return f"ZMB-{final_hmac_id}{check_sum_value}"

def child_seed_generation(name: str, dob, born, mothers_din):
    input_string = f"{name}{dob}{born}{mothers_din}"
    hash_object = hashlib.sha256(input_string.encode())
    return hash_object.digest()

def id_validation(id_to_validate: str):
    din = id_to_validate.removeprefix("ZM-").upper()

    if len(din) != 13:
        return False

    if not all(char in CHARSET for char in din):
        return False

    return din[12] == create_check_sum(din[:12])

