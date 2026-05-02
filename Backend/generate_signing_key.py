#!/usr/bin/env python3
"""
generate_signing_key.py
=======================
Run this ONCE to generate the ZDID server signing keypair.
Paste the output directly into your .env.example file.

Usage:
    python generate_signing_key.py
"""

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

# Generate ECDSA P-256 keypair
private_key = ec.generate_private_key(ec.SECP256R1())
public_key = private_key.public_key()

# Serialize private key to PEM
private_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.TraditionalOpenSSL,
    encryption_algorithm=serialization.NoEncryption(),
).decode()

# Serialize public key to PEM
public_pem = public_key.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo,
).decode()

# Format for .env.example — collapse newlines to \n literal
private_env = private_pem.replace("\n", "\\n")
public_env = public_pem.replace("\n", "\\n")

print("# Add these to your .env.example file:\n")
print(f'ZDID_SIGNING_PRIVATE_KEY="{private_env}"')
print(f'ZDID_SIGNING_PUBLIC_KEY="{public_env}"')
print("\n# Keys generated. Keep the private key secret — never commit it.")
