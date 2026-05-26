import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from "plaid";

/** Server-side Plaid client. Reads PLAID_CLIENT_ID + PLAID_SECRET from env. */
function buildClient(): PlaidApi {
  const env = (process.env.PLAID_ENV ?? "sandbox") as keyof typeof PlaidEnvironments;
  if (!(env in PlaidEnvironments)) {
    throw new Error(`Unknown PLAID_ENV: ${env}`);
  }
  const config = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  });
  return new PlaidApi(config);
}

let cached: PlaidApi | null = null;
export function plaid(): PlaidApi {
  if (!cached) cached = buildClient();
  return cached;
}

/** Products requested when creating Link tokens. Liabilities + investments
 *  unlock the H-002 / H-101 / H-201 hint data sources. */
export const LINK_PRODUCTS: Products[] = [
  Products.Transactions,
  Products.Liabilities,
  Products.Investments,
];

export const LINK_COUNTRY_CODES: CountryCode[] = [
  CountryCode.Us,
  CountryCode.Ca,
];

/** Map Plaid's `type` taxonomy to our account_type CHECK enum. */
export function mapPlaidAccountType(plaidType: string): "bank" | "investment" | "loan" | "cash" {
  switch (plaidType) {
    case "depository":
      return "bank";
    case "investment":
    case "brokerage":
      return "investment";
    case "credit":
    case "loan":
      return "loan";
    default:
      return "bank";
  }
}

/** Plaid 'type' → our category enum (asset vs debt). */
export function mapPlaidCategory(plaidType: string): "asset" | "debt" {
  return plaidType === "credit" || plaidType === "loan" ? "debt" : "asset";
}
