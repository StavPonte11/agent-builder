import os
from cryptography.fernet import Fernet
import json

class CryptoUtils:
    """
    Utility class for application-level encryption of sensitive database fields.
    Uses AES-128 in CBC mode (Fernet).
    """
    
    @staticmethod
    def _get_key() -> bytes:
        """
        Retrieves the master encryption key from the environment.
        In a production environment, this should be fetched from a KMS (AWS KMS, HashiCorp Vault).
        """
        secret = os.environ.get("DB_ENCRYPTION_KEY")
        if not secret:
            # Fallback for development if not provided, but warns heavily.
            # A hardcoded fallback is inherently insecure, but prevents the app from crashing in local dev.
            # The key must be exactly 32 url-safe base64-encoded bytes.
            import warnings
            warnings.warn("DB_ENCRYPTION_KEY environment variable not set. Using insecure fallback key!")
            secret = "XyZ123ABC_VulnerablE_KeY_DoNotUse_InProd123="
        return secret.encode()

    @staticmethod
    def encrypt_dict(data: dict) -> str:
        """Encrypts a Python dictionary and returns a base64 encoded string."""
        if not data:
            return ""
        f = Fernet(CryptoUtils._get_key())
        json_bytes = json.dumps(data).encode('utf-8')
        return f.encrypt(json_bytes).decode('utf-8')

    @staticmethod
    def decrypt_dict(encrypted_str: str) -> dict:
        """Decrypts a base64 encoded string back to a Python dictionary."""
        if not encrypted_str:
            return {}
        try:
            f = Fernet(CryptoUtils._get_key())
            decrypted_bytes = f.decrypt(encrypted_str.encode('utf-8'))
            return json.loads(decrypted_bytes.decode('utf-8'))
        except Exception as e:
            # Log error but return empty dict to not crash entire read operations
            print(f"Failed to decrypt data: {e}")
            return {}
