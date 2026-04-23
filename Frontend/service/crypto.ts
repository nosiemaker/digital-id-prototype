const DB_NAME = "ZDID_Store";
const DB_VERSION = 1;
const  KEY_STORE = 'keys';

interface KeyRecord {
    id: string;
    privateKey: CryptoKey;
    publicKey: JsonWebKey;
    createdAt: string;
}

class CryptoService {
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        if (this.db) return;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(KEY_STORE)) {
                    db.createObjectStore(KEY_STORE, { keyPath: 'id' })
                }
            };
        });
    }
    /**
     * Generates ECDSA P-256 key pair
     * @returns publickey:exporeted as JWT for backend.
     */
    async generateKeys(): Promise<{ publicKeyJwt:JsonWebKey; success: boolean}> {
        try {
            await this.init();

            const keyPair = await crypto.subtle.generateKey(
                {
                    name: 'ECDSA',
                    namedCurve: 'p-256'
                },
                false,
                ['sign', 'verify']
            );

            const publicKeyJwt = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

            const record: KeyRecord = {
                id: 'citizen_signing_key',
                privateKey: keyPair.privateKey,
                publicKey: publicKeyJwt,
                createdAt: new Date().toISOString()
            };

            await this.saveRecord(record);

            return { publicKeyJwt, success: true}
        } catch (error) {
            console.error('Key generation failed:', error);
            return { publicKeyJwt: null as any, success: false}
        }
    }

    /**
     * Signs the provided data with the citizen's private key
     * @param data - The string data to be signed
     * @returns The signature as an ArrayBuffer, or null if signing fails
     */
    async sign(data: string): Promise<ArrayBuffer | null> {
        try {
            await this.init();
            const encoder = new TextEncoder();
            const record = await this.getRecord('citizen_signing_key')
            if (!record) throw new Error('No key found');
            
            const signture = await crypto.subtle.sign(
                { name: 'ECDSA', hash: 'SHA-256'},
                record.privateKey,
                encoder.encode(data)
            );

            return signture
        } catch (error) {
            console.error('Signing failed:', error);
            return null;
        }
    }

    /**
     * Signs activation challenge (nonce from backend)
     * @param enrollmentId 
     * @param nonce 
     * @returns The signed challenge as a base64url string, or null if signing fails
     */
    async signChallenge(enrollmentId: string, nonce: string): Promise<string | null> {
        const challengeString = `${enrollmentId}:${nonce}${Date.now()}`;
        const signature = await this.sign(challengeString);
        if (!signature) return null;

        return this.bufferToBase64Url(signature);
    }

    /**
     * Sign QR payload for identity display
     * @param din 
     * @param expiry 
     * @returns base64url string of the signature, or null if signing fails 
     */
    async signQRPayload(din: string, expiry: string): Promise<string | null> {
        const payload = JSON.stringify({ din, expiry, issuedAt: Date.now() });
        const signture = await this.sign(payload);
        if (!signture) return null

        return this.bufferToBase64Url(signture);
    }

    /**
     * check if keys exist
     * @returns boolean
     */

    async hasKeys(): Promise<boolean> {
        await this.init();
        const record = await this.getRecord('citizen_signing_key');
        return !!record;
    }

    /**
     * Gets stored public key JWK 
     * @returns The public key as a JsonWebKey, or null if not found
     */
    async getPublicKey(): Promise<JsonWebKey | null> {
        await this.init();
        const record = await this.getRecord('citizen_signing_key');
        return record?.publicKey|| null;
    }

    /**
     * Clear all keys for (logout/reset)
     */

    async clear(): Promise<void> {
        await this.init()

        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction([KEY_STORE], 'readwrite');
            const store = tx.objectStore(KEY_STORE);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error)
        })
    }

    private async saveRecord(record: KeyRecord): Promise<void> {
        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction([KEY_STORE], 'readwrite');
            const store = tx.objectStore(KEY_STORE);
            const req = store.put(record);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    private async getRecord(id: string): Promise<KeyRecord | null> {
        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction([KEY_STORE], 'readonly');
            const store = tx.objectStore(KEY_STORE)
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || null)
            req.onerror = () => reject(req.error);
        })
    }

    private bufferToBase64Url(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '-')
        .replace(/=+$/, '');
    }
}

export const cryptoService = new CryptoService();