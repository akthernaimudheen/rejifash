/**
 * Reji Fashions - UPI payment link + QR helpers.
 *
 * Builds a standards-compliant NPCI UPI intent URL. The same string is what we
 * paint into the QR code, so scanning with any UPI app and tapping the "Pay in
 * app" button on a phone lead to the identical pre-filled payment screen.
 *
 *   upi://pay?pa=<vpa>&pn=<payee>&am=<amount>&cu=INR&tn=<note>&tr=<ref>
 */

const UPI = (() => {
  "use strict";

  // Apps that register their own scheme. Useful on Android where a direct
  // scheme skips the chooser dialog.
  const APPS = [
    { key: "gpay", label: "Google Pay", scheme: "tez://upi/pay", color: "#1A73E8", glyph: "G" },
    { key: "phonepe", label: "PhonePe", scheme: "phonepe://pay", color: "#5F259F", glyph: "P" },
    { key: "paytm", label: "Paytm", scheme: "paytmmp://pay", color: "#00BAF2", glyph: "P" },
    { key: "bhim", label: "BHIM", scheme: "bhim://pay", color: "#0C7C59", glyph: "B" }
  ];

  /** A UPI ID looks like name@bank — cheap sanity check, not a bank lookup. */
  function isValidVpa(vpa) {
    return /^[\w.\-_]{2,64}@[a-zA-Z][\w.\-]{1,32}$/.test(String(vpa || "").trim());
  }

  /** UPI wants exactly two decimal places. */
  function formatAmount(amount) {
    return (Math.round(Number(amount) * 100) / 100).toFixed(2);
  }

  /**
   * Transaction notes travel through several bank systems that reject anything
   * exotic, so keep to alphanumerics, spaces and dashes.
   */
  function sanitizeNote(note, maxLength = 45) {
    return String(note || "")
      .replace(/[^\w\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);
  }

  /** Reference ids must be alphanumeric. */
  function sanitizeRef(ref) {
    return String(ref || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 35);
  }

  /**
   * @param {object} options
   * @param {string} options.vpa        payee UPI ID (pa)
   * @param {string} options.payeeName  payee display name (pn)
   * @param {number} options.amount     amount in INR (am)
   * @param {string} [options.note]     transaction note (tn)
   * @param {string} [options.ref]      order/transaction reference (tr)
   * @param {string} [options.scheme]   defaults to the generic upi:// chooser
   */
  function buildUri({ vpa, payeeName, amount, note, ref, scheme = "upi://pay" }) {
    if (!isValidVpa(vpa)) throw new Error(`"${vpa}" is not a valid UPI ID`);
    const value = Number(amount);
    if (!(value > 0)) throw new Error("Payment amount must be greater than zero");

    // Built by hand rather than URLSearchParams: UPI apps are happier with
    // %20 than the "+" that form-encoding produces for spaces.
    const params = [
      ["pa", vpa.trim()],
      ["pn", sanitizeNote(payeeName, 40)],
      ["am", formatAmount(value)],
      ["cu", "INR"]
    ];
    if (note) params.push(["tn", sanitizeNote(note)]);
    if (ref) params.push(["tr", sanitizeRef(ref)]);

    return `${scheme}?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
  }

  /** Per-app deep links carrying the same payment details. */
  function appLinks(options) {
    return APPS.map(app => ({ ...app, url: buildUri({ ...options, scheme: app.scheme }) }));
  }

  /** Inline SVG QR for the payment, sized to fill its container. */
  function qrSvg(options, qrOptions = {}) {
    if (typeof QRCode === "undefined") throw new Error("qrcode.js must load before upi.js");
    // Level M survives a fair amount of glare and screen reflection while
    // keeping the modules chunky enough for a phone camera to lock on.
    return QRCode.svg(buildUri(options), {
      ecLevel: "M",
      scale: 8,
      quietZone: 3,
      dark: "#101820",
      light: "#FFFFFF",
      className: "rf-qr-svg",
      title: `UPI payment of ₹${formatAmount(options.amount)} to ${options.payeeName}`,
      ...qrOptions
    });
  }

  function isMobile() {
    return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
  }

  return { APPS, buildUri, appLinks, qrSvg, isValidVpa, formatAmount, sanitizeNote, sanitizeRef, isMobile };
})();

if (typeof window !== "undefined") window.UPI = UPI;
if (typeof module !== "undefined" && module.exports) module.exports = UPI;
