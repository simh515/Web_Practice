let sessionKey = null;

async function generateSessionKey() {
  sessionKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const rawKey = await crypto.subtle.exportKey('raw', sessionKey);
  const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
  sessionStorage.setItem('aesKey', keyBase64);
}

async function restoreSessionKey() {
  const keyBase64 = sessionStorage.getItem("aesKey");
  if (!keyBase64) return false;

  const rawKey = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));

  sessionKey = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
  return true;
}

async function encryptEmail(email) {
  if (!sessionKey) await generateSessionKey();

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(email);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sessionKey,
    encoded
  );

  return {
    cipher: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: Array.from(iv)
  };
}

async function decryptEmail(cipher, iv) {
  if (!sessionKey) {
    const restored = await restoreSessionKey();
    if (!restored) return null;
  }

  const encryptedData = Uint8Array.from(atob(cipher), c => c.charCodeAt(0));
  const ivArray = new Uint8Array(iv);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivArray },
    sessionKey,
    encryptedData
  );

  return new TextDecoder().decode(decrypted);
}

async function getDecryptedEmail() {
  try {
    const stored = JSON.parse(sessionStorage.getItem('userEmail'));
    if (!stored) return null;
    return await decryptEmail(stored.cipher, stored.iv);
  } catch (e) {
    console.error("이메일 복호화 실패:", e);
    return null;
  }
}

async function storeEncryptedEmail(email) {
  if (!sessionKey) await generateSessionKey();
  const { cipher, iv } = await encryptEmail(email);
  sessionStorage.setItem('userEmail', JSON.stringify({ cipher, iv }));
}

window.generateSessionKey = generateSessionKey;
window.encryptEmail = encryptEmail;
window.decryptEmail = decryptEmail;
window.getDecryptedEmail = getDecryptedEmail;
window.storeEncryptedEmail = storeEncryptedEmail;
window.restoreSessionKey = restoreSessionKey;
