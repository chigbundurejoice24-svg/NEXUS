/**
 * legal-policies.ts — Complete Aegis legal document store.
 * All policies live here. Auth.tsx and LegalPage.tsx import from this file.
 * To update any policy: edit the text here, it propagates everywhere.
 *
 * Last Updated: June 2026
 */

export interface PolicySection {
  heading?: string;
  body: string[];   // each string is a paragraph or bullet group
}

export interface LegalDoc {
  id: string;
  title: string;
  lastUpdated: string;
  summary?: string;   // 1-sentence plain-English summary shown in the consent UI
  sections: PolicySection[];
}

const UPDATED = "June 2026";

// ─────────────────────────────────────────────────────────────────────────────
// 1. TERMS OF SERVICE
// ─────────────────────────────────────────────────────────────────────────────
export const TERMS_OF_SERVICE: LegalDoc = {
  id: "terms",
  title: "Terms of Service",
  lastUpdated: UPDATED,
  summary: "The rules that govern your use of Aegis.",
  sections: [
    {
      heading: "1. Introduction",
      body: [
        "These Terms of Service govern your access to and use of the Aegis platform, website, applications, APIs, and related services (collectively, the \"Service\").",
        "By creating an account, accessing, or using the Service, you acknowledge that you have read, understood, and agree to be legally bound by these Terms, our Privacy Policy, Risk Disclosure Statement, and any additional policies incorporated by reference.",
        "If you do not agree to these Terms, you must not use the Service.",
      ],
    },
    {
      heading: "2. Eligibility",
      body: [
        "To use the Service you must be at least 18 years old, possess legal capacity to enter into binding agreements, comply with all applicable laws, and not be listed on any sanctions list.",
        "Aegis reserves the right to restrict or terminate access if these requirements are not satisfied.",
      ],
    },
    {
      heading: "3. Non-Custodial Nature",
      body: [
        "Aegis is a non-custodial software platform. Aegis does not hold user funds, store private keys, control user wallets, initiate transactions on behalf of users, or act as a bank, broker, exchange, or custodian.",
        "All Digital Assets remain under the sole control of the User. Users are solely responsible for maintaining access to their wallets, authentication credentials, passkeys, devices, and recovery mechanisms. Aegis cannot recover lost private keys, passkeys, seed phrases, or funds.",
      ],
    },
    {
      heading: "4. User Responsibilities",
      body: [
        "You are solely responsible for securing your device and authentication credentials, verifying wallet addresses before confirming transactions, reviewing transaction details before signing, maintaining compliance with laws applicable to you, and paying any taxes arising from your activities.",
        "You acknowledge that blockchain transactions are generally irreversible. Any transaction submitted to a blockchain network may be impossible to cancel, reverse, or modify.",
      ],
    },
    {
      heading: "5. Prohibited Activities",
      body: [
        "You agree not to: violate applicable laws, engage in money laundering, facilitate terrorist financing, circumvent sanctions, commit fraud, impersonate another person, interfere with platform security, upload malicious software, abuse referral programs, or attempt unauthorized access to systems.",
      ],
    },
    {
      heading: "6. Fees",
      body: [
        "Certain features may be subject to fees. Applicable fees will be disclosed before transaction confirmation. Fees become non-refundable once the associated transaction has been submitted for execution. Aegis reserves the right to modify fees at any time with reasonable notice.",
      ],
    },
    {
      heading: "7. Disclaimer of Warranties",
      body: [
        "THE SERVICE IS PROVIDED \"AS IS\" AND \"AS AVAILABLE.\" TO THE MAXIMUM EXTENT PERMITTED BY LAW, AEGIS DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, SECURITY, AVAILABILITY, OR ACCURACY.",
      ],
    },
    {
      heading: "8. Limitation of Liability",
      body: [
        "TO THE MAXIMUM EXTENT PERMITTED BY LAW, AEGIS SHALL NOT BE LIABLE FOR LOSS OF DIGITAL ASSETS, LOSS OF PROFITS, LOSS OF REVENUE, LOSS OF DATA, INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR PUNITIVE DAMAGES.",
        "IN NO EVENT SHALL AEGIS' TOTAL LIABILITY EXCEED THE TOTAL FEES PAID BY THE USER TO AEGIS DURING THE TWELVE (12) MONTHS PRECEDING THE CLAIM.",
      ],
    },
    {
      heading: "9. Governing Law & Disputes",
      body: [
        "These Terms shall be governed by the laws of the Federal Republic of Nigeria. Any unresolved dispute shall be submitted to binding arbitration in Lagos, Nigeria, conducted in English. The arbitrator's decision shall be final and binding.",
      ],
    },
    {
      heading: "10. Contact",
      body: ["For questions: info@cozanet.net — Aegis Support Team."],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. PRIVACY POLICY
// ─────────────────────────────────────────────────────────────────────────────
export const PRIVACY_POLICY: LegalDoc = {
  id: "privacy",
  title: "Privacy Policy",
  lastUpdated: UPDATED,
  summary: "How we collect, use, and protect your personal information.",
  sections: [
    {
      heading: "1. Introduction",
      body: [
        "Aegis respects your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, store, and protect information when you access or use the Service.",
        "Because Aegis is non-custodial, we do not store private keys, seed phrases, or control user wallets.",
      ],
    },
    {
      heading: "2. Information We Collect",
      body: [
        "Information you provide: email address, username, wallet addresses, support communications, identity verification information where required.",
        "Account information: account identifiers, authentication credentials, passkey credential identifiers. We do not receive or store biometric data generated by your device.",
        "Transaction information: transaction identifiers, blockchain network information, wallet addresses, timestamps, status, service fee information.",
        "Device and technical information: IP address, browser type, device type, OS, error logs, security logs, access timestamps.",
      ],
    },
    {
      heading: "3. How We Use Information",
      body: [
        "We may use information to: provide and maintain the Service, authenticate users, detect fraud and abuse, respond to support requests, comply with legal obligations, enforce our Terms of Service, communicate service updates, and manage referral and rewards programs.",
      ],
    },
    {
      heading: "4. Sharing of Information",
      body: [
        "We do not sell personal information.",
        "We may share information with: service providers (hosting, database, identity verification, payment providers), and where required by law, court order, or regulatory authority.",
      ],
    },
    {
      heading: "5. Blockchain Data",
      body: [
        "Transactions submitted to public blockchains may be publicly visible, permanently recorded, and searchable by third parties. Aegis cannot modify, delete, or control information stored on public blockchains.",
      ],
    },
    {
      heading: "6. Your Rights",
      body: [
        "Depending on your jurisdiction, you may have rights including: access, correction, deletion, restriction of processing, data portability, and right to object. Contact us at info@cozanet.net to exercise these rights.",
      ],
    },
    {
      heading: "7. Data Retention",
      body: [
        "We retain information only for as long as reasonably necessary. Account information while active; security logs for limited periods; compliance records where required by law.",
      ],
    },
    {
      heading: "8. Children's Privacy",
      body: [
        "The Service is not intended for persons under 18 years of age. We do not knowingly collect personal information from minors.",
      ],
    },
    {
      heading: "9. Contact",
      body: ["For privacy questions: info@cozanet.net — Aegis Privacy Team."],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. RISK DISCLOSURE
// ─────────────────────────────────────────────────────────────────────────────
export const RISK_DISCLOSURE: LegalDoc = {
  id: "risk",
  title: "Risk Disclosure Statement",
  lastUpdated: UPDATED,
  summary: "Digital assets are high-risk. You could lose everything.",
  sections: [
    {
      heading: "1. General Risk",
      body: [
        "Digital assets involve significant risks, including total loss of funds. Users are solely responsible for their financial decisions. Aegis does not provide financial, investment, legal, or tax advice.",
      ],
    },
    {
      heading: "2. Specific Risks",
      body: [
        "Price volatility: digital asset values may fluctuate significantly or become worthless.",
        "Smart contract vulnerabilities: code may contain bugs or be exploited.",
        "Regulatory uncertainty: laws governing digital assets continue to evolve.",
        "Blockchain network failures: congestion, forks, or outages may affect transactions.",
        "Loss of access credentials: lost passkeys, private keys, or seed phrases may result in permanent loss of funds.",
        "Liquidity risks: you may be unable to sell or transfer assets at desired prices.",
        "Third-party service failures: on-ramp and off-ramp providers, oracles, and infrastructure providers may fail.",
      ],
    },
    {
      heading: "3. Non-Custodial Risk",
      body: [
        "Because Aegis is non-custodial, we cannot recover lost credentials or reverse transactions. You accept full responsibility for securing your wallet, passkey, and device.",
      ],
    },
    {
      heading: "4. No Guarantees",
      body: [
        "All services are provided on an \"as is\" and \"as available\" basis. Cozanet makes no guarantees regarding platform performance, transaction success, asset value, service availability, or pricing accuracy.",
      ],
    },
    {
      heading: "5. Acknowledgment",
      body: [
        "By using Aegis, you acknowledge these risks and confirm that you are making independent, informed decisions.",
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. KYC POLICY
// ─────────────────────────────────────────────────────────────────────────────
export const KYC_POLICY: LegalDoc = {
  id: "kyc",
  title: "KYC & Identity Verification Policy",
  lastUpdated: UPDATED,
  summary: "When and why we may verify your identity.",
  sections: [
    {
      heading: "1. Purpose",
      body: [
        "This Policy explains how Cozanet may verify user identities. It helps protect users, maintain platform integrity, reduce fraud, and support compliance with applicable laws.",
      ],
    },
    {
      heading: "2. When Verification May Be Required",
      body: [
        "Identity verification may be requested when: using fiat on-ramp or off-ramp services, receiving bank payouts, accessing business features, recovering an account, or complying with legal obligations.",
        "Requirements may vary by country, service, transaction size, risk level, or applicable regulations.",
      ],
    },
    {
      heading: "3. Information That May Be Requested",
      body: [
        "Basic information: full legal name, date of birth, residential address, nationality, email, phone number.",
        "Identity documents: national ID, passport, driver's license, residence permit, or other government-issued ID.",
        "Verification media: selfie photograph, liveness verification, or video verification.",
      ],
    },
    {
      heading: "4. Verification Providers",
      body: [
        "Cozanet may use trusted third-party providers including Dojah, Smile Identity, Veriff, Sumsub, or similar compliance providers. These providers process information under their own privacy policies.",
      ],
    },
    {
      heading: "5. Accuracy",
      body: [
        "Users must submit accurate, current, and truthful information. Submission of false, forged, or stolen information may result in verification failure, account suspension or termination, and referral to authorities where required.",
      ],
    },
    {
      heading: "6. Refusal to Verify",
      body: [
        "Users may choose not to complete verification. However, certain services will become unavailable or restricted where verification is required.",
      ],
    },
    {
      heading: "7. Contact",
      body: ["For questions: info@cozanet.net — Cozanet Compliance Team."],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. AML POLICY
// ─────────────────────────────────────────────────────────────────────────────
export const AML_POLICY: LegalDoc = {
  id: "aml",
  title: "AML & Financial Crime Prevention Policy",
  lastUpdated: UPDATED,
  summary: "We do not allow the platform to be used for financial crime.",
  sections: [
    {
      heading: "1. Commitment",
      body: [
        "Cozanet is committed to preventing the use of Aegis for money laundering, terrorist financing, sanctions evasion, fraud, corruption, bribery, organized crime, tax evasion, cybercrime proceeds, or other financial crimes.",
      ],
    },
    {
      heading: "2. Prohibited Activities",
      body: [
        "Users may not use Aegis for money laundering, terrorist financing, human trafficking, sanctions evasion, fraud, corruption, organized crime, or any unlawful financial activity.",
      ],
    },
    {
      heading: "3. Monitoring & Screening",
      body: [
        "Cozanet may conduct sanctions screening, PEP screening, watchlist screening, fraud detection screening, and blockchain risk analysis.",
        "Activity may be monitored for indicators of financial crime including structuring transactions, rapid movement of funds, fraudulent account creation, and high-risk wallet interactions.",
      ],
    },
    {
      heading: "4. Reporting Obligations",
      body: [
        "Where required by law, Cozanet may file reports with competent authorities, respond to lawful requests, and cooperate with investigations. Nothing in this Policy obligates Cozanet to notify users when such actions occur.",
      ],
    },
    {
      heading: "5. User Responsibilities",
      body: [
        "Users agree they will not use Aegis for unlawful activity, conceal criminal proceeds, circumvent sanctions, provide false information, use stolen identities, or facilitate illegal transactions.",
      ],
    },
    {
      heading: "6. Contact",
      body: ["For questions: info@cozanet.net — Cozanet Compliance Team."],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. ACCEPTABLE USE POLICY
// ─────────────────────────────────────────────────────────────────────────────
export const ACCEPTABLE_USE_POLICY: LegalDoc = {
  id: "aup",
  title: "Acceptable Use Policy",
  lastUpdated: UPDATED,
  summary: "What you can and cannot do on the platform.",
  sections: [
    {
      heading: "1. Purpose",
      body: [
        "This Acceptable Use Policy governs the use of Aegis and all related products, services, and features. Failure to comply may result in suspension, restriction, termination, or reporting to authorities.",
      ],
    },
    {
      heading: "2. Prohibited Activities",
      body: [
        "Financial crime: money laundering, terrorist financing, sanctions evasion, fraudulent transactions, identity theft, Ponzi or pyramid schemes, market manipulation.",
        "Fraud and deception: misrepresenting identity, using stolen credentials or funds, impersonation, submitting false information.",
        "Security violations: unauthorized access, circumventing authentication, exploiting vulnerabilities, distributing malware.",
        "Network abuse: denial-of-service attacks, overloading systems, API abuse beyond documented limits.",
        "Referral program abuse: multiple accounts, self-referrals, bots, artificial activity.",
        "Harassment and abuse: threatening, intimidating, or promoting unlawful conduct toward users or staff.",
      ],
    },
    {
      heading: "3. Enforcement",
      body: [
        "Violations may result in warnings, temporary restrictions, suspension, permanent termination, revocation of rewards, or reporting to law enforcement. Cozanet may act immediately where necessary.",
      ],
    },
    {
      heading: "4. Contact",
      body: ["For questions: info@cozanet.net — Cozanet Compliance Team."],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. CZN TOKEN DISCLOSURE
// ─────────────────────────────────────────────────────────────────────────────
export const CZN_DISCLOSURE: LegalDoc = {
  id: "czn",
  title: "Cozanet (CZN) Utility Token Disclosure",
  lastUpdated: UPDATED,
  summary: "CZN is a utility token, not an investment or security.",
  sections: [
    {
      heading: "1. Purpose of CZN",
      body: [
        "CZN is designed as a utility token within the Cozanet ecosystem for: transaction fee reductions, access to selected platform features, referral and rewards programs, and future governance participation.",
      ],
    },
    {
      heading: "2. No Ownership Rights",
      body: [
        "Ownership of CZN does not grant equity ownership in Cozanet or Aegis, shares in any company, voting rights in any corporation, rights to company assets, revenue, profits, dividends, or liquidation proceeds.",
      ],
    },
    {
      heading: "3. No Investment Contract",
      body: [
        "CZN is not intended to be a security, stock, bond, derivative, collective investment scheme, or investment contract. Do not acquire CZN with an expectation of profit.",
      ],
    },
    {
      heading: "4. Market & Regulatory Risk",
      body: [
        "The value of CZN may fluctuate significantly or become negligible. Digital asset regulation continues to evolve globally and may affect the availability, transferability, or utility of CZN.",
      ],
    },
    {
      heading: "5. Contact",
      body: ["For questions: info@cozanet.net — Cozanet Team."],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. COOKIE POLICY
// ─────────────────────────────────────────────────────────────────────────────
export const COOKIE_POLICY: LegalDoc = {
  id: "cookies",
  title: "Cookie Policy",
  lastUpdated: UPDATED,
  summary: "We use cookies for security, authentication, and performance.",
  sections: [
    {
      heading: "1. What Are Cookies?",
      body: [
        "Cookies are small text files stored on your device when you use an online service. They help websites function, remember preferences, improve security, and analyze usage.",
      ],
    },
    {
      heading: "2. Technologies We Use",
      body: [
        "Aegis may use: cookies, local storage, session storage, authentication tokens, device identifiers, and security tokens.",
      ],
    },
    {
      heading: "3. Types of Cookies",
      body: [
        "Essential cookies: required for authentication, login sessions, security verification, and fraud prevention.",
        "Security cookies: session validation, login protection, and abuse detection.",
        "Performance cookies: error tracking, platform reliability monitoring.",
        "Preference cookies: language settings, UI preferences, accessibility settings.",
      ],
    },
    {
      heading: "4. Managing Cookies",
      body: [
        "Most browsers allow you to view, delete, block, or restrict cookies. Disabling essential cookies may affect platform functionality and some features may become unavailable.",
      ],
    },
    {
      heading: "5. Contact",
      body: ["For questions: info@cozanet.net — Cozanet Privacy Team."],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 9. REFERRAL PROGRAM TERMS
// ─────────────────────────────────────────────────────────────────────────────
export const REFERRAL_TERMS: LegalDoc = {
  id: "referral",
  title: "Referral Program Terms",
  lastUpdated: UPDATED,
  summary: "Rules for earning referral rewards.",
  sections: [
    {
      heading: "1. Eligibility",
      body: [
        "To participate you must have a valid Aegis account, remain in good standing, comply with applicable laws, and meet any additional requirements established by Cozanet.",
      ],
    },
    {
      heading: "2. Qualified Referrals",
      body: [
        "A referral is qualified only when all applicable conditions are satisfied, including: creation of a valid account, completion of required verification, compliance with policies, and absence of fraudulent activity. Cozanet has sole discretion in determining qualification.",
      ],
    },
    {
      heading: "3. Prohibited Conduct",
      body: [
        "Users may not: self-refer, create multiple accounts, use fake or stolen identities, use bots or automation, generate artificial activity, purchase referrals, misrepresent Aegis, make misleading claims, or send spam.",
      ],
    },
    {
      heading: "4. Reward Reversal",
      body: [
        "Cozanet may withhold, reverse, or cancel rewards where fraud is detected, abuse is suspected, referrals violate these Terms, or compliance concerns arise.",
      ],
    },
    {
      heading: "5. No Guaranteed Earnings",
      body: [
        "Participation does not guarantee income, profit, commission levels, or reward availability. Rewards may be modified, suspended, or discontinued at Cozanet's discretion.",
      ],
    },
    {
      heading: "6. Contact",
      body: ["For questions: info@cozanet.net — Cozanet Growth Team."],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 10. COMPLAINTS POLICY
// ─────────────────────────────────────────────────────────────────────────────
export const COMPLAINTS_POLICY: LegalDoc = {
  id: "complaints",
  title: "Complaints & Dispute Resolution Policy",
  lastUpdated: UPDATED,
  summary: "How to raise a complaint and what to expect.",
  sections: [
    {
      heading: "1. How to Submit a Complaint",
      body: [
        "Email: info@cozanet.net — Subject: Formal Complaint – Aegis.",
        "Please include: full name, account email, wallet address involved, description of the issue, relevant transaction identifiers, and desired resolution.",
      ],
    },
    {
      heading: "2. Response Timeframes",
      body: [
        "Cozanet aims to acknowledge complaints within 7 business days and seek resolution within 30 business days. Complex investigations may require additional time.",
      ],
    },
    {
      heading: "3. Non-Custodial Limitations",
      body: [
        "Because Aegis is non-custodial, Cozanet generally cannot reverse blockchain transactions, recover funds sent to incorrect addresses, cancel completed transfers, access user wallets, or restore lost credentials.",
      ],
    },
    {
      heading: "4. Arbitration",
      body: [
        "Unresolved disputes shall be submitted to binding arbitration in Lagos, Nigeria, conducted in English. Decisions are final and binding. Users waive the right to participate in class-action proceedings to the extent permitted by law.",
      ],
    },
    {
      heading: "5. Contact",
      body: ["For questions: info@cozanet.net — Cozanet Compliance & Support Team."],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSENT CHECKLIST — used in Auth.tsx sign-up step
// ─────────────────────────────────────────────────────────────────────────────
export interface ConsentItem {
  id: string;
  text: string;
  required: boolean;
  linkedPolicyId?: string;
}

export const CONSENT_ITEMS: ConsentItem[] = [
  {
    id: "age",
    text: "I confirm that I am at least 18 years old",
    required: true,
  },
  {
    id: "terms",
    text: "I agree to the Terms of Service",
    required: true,
    linkedPolicyId: "terms",
  },
  {
    id: "privacy",
    text: "I have read and understood the Privacy Policy",
    required: true,
    linkedPolicyId: "privacy",
  },
  {
    id: "risk",
    text: "I understand the Risk Disclosure — digital assets involve risk of loss",
    required: true,
    linkedPolicyId: "risk",
  },
  {
    id: "noncustodial",
    text: "I understand Aegis is non-custodial — I am responsible for my wallet and assets",
    required: true,
  },
  {
    id: "aml",
    text: "I agree to comply with the AML & Financial Crime Prevention Policy",
    required: true,
    linkedPolicyId: "aml",
  },
  {
    id: "cookies",
    text: "I accept the use of essential cookies for security and authentication",
    required: true,
    linkedPolicyId: "cookies",
  },
];

// All policy docs — used by the /legal page router
export const ALL_POLICIES: LegalDoc[] = [
  TERMS_OF_SERVICE,
  PRIVACY_POLICY,
  RISK_DISCLOSURE,
  KYC_POLICY,
  AML_POLICY,
  ACCEPTABLE_USE_POLICY,
  CZN_DISCLOSURE,
  COOKIE_POLICY,
  REFERRAL_TERMS,
  COMPLAINTS_POLICY,
];
