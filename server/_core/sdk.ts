/**
 * sdk.ts — Legacy Manus OAuth SDK (Phase 1 compatibility shim)
 * Called by context.ts only when OAUTH_SERVER_URL is set.
 * The @shared/* aliases are replaced with inlined values so Vercel can compile.
 */
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

// ── Inlined from @shared/const ────────────────────────────────────────────────
const AXIOS_TIMEOUT_MS = 10_000;
const COOKIE_NAME      = "aegis_session";
const ONE_YEAR_MS      = 365 * 24 * 60 * 60 * 1000;

// ── Inlined from @shared/_core/errors ────────────────────────────────────────
class ForbiddenError extends Error {
  constructor(message = "Forbidden") { super(message); this.name = "ForbiddenError"; }
}

// ── Types (was in types/manusTypes.ts) ───────────────────────────────────────
interface ExchangeTokenRequest  { code: string; redirectUri: string; }
interface ExchangeTokenResponse { token: string; }
interface GetUserInfoResponse   { openId: string; name: string; email?: string; }
interface GetUserInfoWithJwtRequest  { jwt: string; }
interface GetUserInfoWithJwtResponse { openId: string; name: string; email?: string; }

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.length > 0;

export type SessionPayload = { openId: string; appId: string; name: string };

const EXCHANGE_TOKEN_PATH        = "/webdev.v1.WebDevAuthPublicService/ExchangeToken";
const GET_USER_INFO_PATH         = "/webdev.v1.WebDevAuthPublicService/GetUserInfo";
const GET_USER_INFO_WITH_JWT_PATH= "/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt";

class OAuthService {
  constructor(private client: ReturnType<typeof axios.create>) {}

  async exchangeToken(params: ExchangeTokenRequest): Promise<ExchangeTokenResponse> {
    const { data } = await this.client.post<ExchangeTokenResponse>(EXCHANGE_TOKEN_PATH, params);
    return data;
  }

  async getUserInfo(token: string): Promise<GetUserInfoResponse> {
    const { data } = await this.client.post<GetUserInfoResponse>(
      GET_USER_INFO_PATH, {}, { headers: { Authorization: `Bearer ${token}` } }
    );
    return data;
  }

  async getUserInfoWithJwt(params: GetUserInfoWithJwtRequest): Promise<GetUserInfoWithJwtResponse> {
    const { data } = await this.client.post<GetUserInfoWithJwtResponse>(GET_USER_INFO_WITH_JWT_PATH, params);
    return data;
  }
}

// ── SDK main class ────────────────────────────────────────────────────────────
class AegisSDK {
  private oAuthService: OAuthService;
  private jwtSecret: Uint8Array;

  constructor() {
    const client = axios.create({
      baseURL: ENV.oAuthServerUrl,
      timeout: AXIOS_TIMEOUT_MS,
      headers: { "Content-Type": "application/json" },
    });
    this.oAuthService = new OAuthService(client);
    this.jwtSecret = new TextEncoder().encode(ENV.cookieSecret || "aegis-dev-secret");
  }

  async authenticateRequest(req: Request): Promise<User | null> {
    try {
      const cookieHeader = req.headers.cookie ?? "";
      const cookies = parseCookieHeader(cookieHeader);
      const sessionToken = cookies[COOKIE_NAME];
      if (!isNonEmptyString(sessionToken)) return null;

      const { payload } = await jwtVerify(sessionToken, this.jwtSecret);
      const openId = payload.openId as string | undefined;
      if (!isNonEmptyString(openId)) return null;

      const dbClient = await db.getDb();
      if (!dbClient) return null;
      const user = await db.getUserByOpenId(openId);
      return user ?? null;
    } catch {
      return null;
    }
  }

  async createSessionToken(payload: SessionPayload): Promise<string> {
    return new SignJWT(payload as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(Date.now() + ONE_YEAR_MS)
      .sign(this.jwtSecret);
  }
}

export const sdk = new AegisSDK();
