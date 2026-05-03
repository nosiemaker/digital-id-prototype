import { useState, useEffect, useCallback} from 'react';
import { cryptoService } from '@/service/crypto';

export function useCrypto() {
    const [ready, setReady] = useState(false);
    const [hasKey, setHasKey] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        cryptoService.init().then(() => {
            setReady(true);
            checkKey();
        });
    }, []);

    const checkKey = async () => {
        const exists = await cryptoService.hasKeys();
        setHasKey(exists);

    };

    const genarateKeys = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await cryptoService.generateKeys();
            if (result.success) {
                setHasKey(true);
                return result.publicKeyJwt;
            }
            return null
        } finally {
            setIsLoading(false);
        }
    }, [])

    const signChallenge = useCallback(async (enrollmentId: string, nonce: string) => {
        return cryptoService.signChallenge(enrollmentId, nonce);
    }, [])

    const signQR = useCallback(async (din: string, expiry: string) => {
        return cryptoService.signQRPayload(din, expiry);
    }, [])

    return {
        ready,
        hasKey,
        isLoading,
        genarateKeys,
        signChallenge,
        signQR,
        refresh: checkKey
    };
}
