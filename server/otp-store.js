/**
 * In-memory OTP store with expiry.
 * Structure: email -> { otp: string, expiresAt: number }
 */
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

const store = new Map();

/**
 * Generate a 6-digit OTP, store it for the given email, and return it.
 */
function generateOtp(email) {
    const otp = String(Math.floor(100000 + Math.random() * 900000)); // always 6 digits
    store.set(email.toLowerCase(), {
        otp,
        expiresAt: Date.now() + OTP_TTL_MS,
    });
    return otp;
}

/**
 * Verify the OTP for the given email.
 * Returns true if valid and not expired; false otherwise.
 * Deletes the OTP entry on successful verification.
 */
function verifyOtp(email, inputOtp) {
    const key = email.toLowerCase();
    const entry = store.get(key);

    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return false;
    }
    if (entry.otp !== String(inputOtp)) return false;

    store.delete(key); // consume OTP (one-time use)
    return true;
}

/**
 * Check whether a valid (non-expired) OTP session exists for the email.
 * Used by the reset-password route to confirm the user has been verified.
 * NOTE: We keep a separate "password-reset-allowed" flag after OTP is consumed.
 */
const resetAllowed = new Set();

function markResetAllowed(email) {
    resetAllowed.add(email.toLowerCase());
    // Auto-expire after 15 minutes
    setTimeout(() => resetAllowed.delete(email.toLowerCase()), 15 * 60 * 1000);
}

function isResetAllowed(email) {
    return resetAllowed.has(email.toLowerCase());
}

function clearResetAllowed(email) {
    resetAllowed.delete(email.toLowerCase());
}

// Exposed for testing purposes
function _getStore() { return store; }

module.exports = { generateOtp, verifyOtp, markResetAllowed, isResetAllowed, clearResetAllowed, _getStore };
