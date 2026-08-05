import type { PoolConfig } from "pg";

/**
 * Supabase's own root certificate, inlined rather than read from disk so it
 * survives bundling on any host without a file-tracing rule.
 *
 * Supabase does not use a publicly trusted CA — its servers present
 *   *.pooler.supabase.com  <-  Supabase Intermediate 2021 CA  <-  Supabase Root 2021 CA
 * and that root is in nobody's trust store. The usual advice is to switch
 * verification off (`sslmode=no-verify`), which also switches off the
 * protection against someone impersonating the database. Trusting this one
 * certificate instead keeps full verification, hostname check included.
 *
 * Source: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
 * SHA-256: 80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:
 *          82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA
 * Verified on 2026-07-31 to match the root served live by the pooler.
 * Expires 2031-04-26.
 */
export const SUPABASE_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----
`;

/** True for the hosts that serve the certificate above. */
export function isSupabaseHost(connectionString: string): boolean {
  let host: string;
  try {
    host = new URL(connectionString).hostname;
  } catch {
    return false;
  }
  return /(^|\.)supabase\.(com|co)$/i.test(host);
}

/** SSL parameters `pg` reads off the connection string, which we may override. */
const SSL_PARAMS = ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"];

/**
 * Turns a connection string into the config the pool is opened with.
 *
 * `pg` lets the connection string win over anything passed in code: given both
 * a `sslmode` parameter and an `ssl` object, it keeps the parameter and throws
 * the object away — certificate and all. Supabase hands out URLs ending in
 * `?sslmode=require`, so pasting one verbatim would silently discard the root
 * certificate above and fail with SELF_SIGNED_CERT_IN_CHAIN. Dropping the
 * parameter first is what makes the `ssl` option take effect.
 *
 * Only Supabase hosts are touched. Every other provider keeps its connection
 * string exactly as written, because `ssl.ca` *replaces* the public trust store
 * rather than adding to it, and would break a provider using a normal
 * certificate — including the plaintext local development database.
 */
export function poolConfig(connectionString: string): PoolConfig {
  if (!isSupabaseHost(connectionString)) return { connectionString };

  const url = new URL(connectionString);
  for (const key of SSL_PARAMS) url.searchParams.delete(key);
  return { connectionString: url.toString(), ssl: { ca: SUPABASE_ROOT_CA } };
}
