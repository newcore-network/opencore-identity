import type { AccountIdentifiers } from "../types";

export interface AccountCreatedEvent {
  accountId: number;
  uuid: string;
  identifiers: AccountIdentifiers;
}

export interface AccountBannedEvent {
  accountId: number;
  reason?: string | null;
  expires?: Date | null;
}

export interface AccountUnbannedEvent {
  accountId: number;
}

export interface AccountLoggedInEvent {
  accountId: number;
  uuid: string;
}

export interface IdentityEventMap {
  "identity:accountCreated": AccountCreatedEvent;
  "identity:accountBanned": AccountBannedEvent;
  "identity:accountUnbanned": AccountUnbannedEvent;
  "identity:accountLoggedIn": AccountLoggedInEvent;
}
