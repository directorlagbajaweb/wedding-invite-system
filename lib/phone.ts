/**
 * Converts a phone number to the digits-only international form wa.me expects.
 * Nigerian local numbers are converted: 0803 123 4567 → 2348031234567.
 * Returns null if it doesn't look like a usable number.
 */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2); // 00234… international prefix
  if (digits.length === 11 && digits.startsWith("0")) digits = `234${digits.slice(1)}`;
  else if (digits.length === 10 && /^[789]/.test(digits)) digits = `234${digits}`;
  else if (digits.startsWith("2340")) digits = `234${digits.slice(4)}`; // +234 0803…
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function whatsAppLink(phone: string | null, name: string, inviteUrl: string): string | null {
  const number = toWhatsAppNumber(phone);
  if (!number) return null;
  const firstName = name.trim().split(/\s+/)[0] ?? "";
  const text = `Hi ${firstName}, you’re invited to Racheal & Christian’s wedding \u{1F48D} Open your personal invitation here: ${inviteUrl}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
