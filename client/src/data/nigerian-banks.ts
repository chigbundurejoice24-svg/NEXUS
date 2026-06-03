/**
 * nigerian-banks.ts
 * Common Nigerian bank codes (Paystack / Flutterwave compatible).
 * Used in the SendMoney bank selector dropdown.
 */
export interface Bank {
  name: string;
  code: string;
}

export const NIGERIAN_BANKS: Bank[] = [
  { name: "Access Bank",              code: "044" },
  { name: "Access Bank (Diamond)",    code: "063" },
  { name: "Citibank Nigeria",         code: "023" },
  { name: "Ecobank Nigeria",          code: "050" },
  { name: "Fidelity Bank",            code: "070" },
  { name: "First Bank of Nigeria",    code: "011" },
  { name: "First City Monument Bank", code: "214" },
  { name: "Globus Bank",              code: "00103" },
  { name: "Guaranty Trust Bank",      code: "058" },
  { name: "Heritage Bank",            code: "030" },
  { name: "Keystone Bank",            code: "082" },
  { name: "Kuda Bank",                code: "50211" },
  { name: "Opay (OPay Digital)",      code: "100004" },
  { name: "Palmpay",                  code: "100033" },
  { name: "Polaris Bank",             code: "076" },
  { name: "Providus Bank",            code: "101" },
  { name: "Stanbic IBTC Bank",        code: "221" },
  { name: "Standard Chartered",       code: "068" },
  { name: "Sterling Bank",            code: "232" },
  { name: "Suntrust Bank",            code: "100" },
  { name: "Titan Trust Bank",         code: "102" },
  { name: "Union Bank of Nigeria",    code: "032" },
  { name: "United Bank For Africa",   code: "033" },
  { name: "Unity Bank",               code: "215" },
  { name: "VFD Microfinance Bank",    code: "566" },
  { name: "Wema Bank",                code: "035" },
  { name: "Zenith Bank",              code: "057" },
];
