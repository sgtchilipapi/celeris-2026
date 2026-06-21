"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
  type ConfigureManagedActionInput,
  type ConfigureCreditsPricingInput,
  configureAllowedOriginsSchema,
  configureCreditsPricingSchema,
  configureManagedActionSchema,
  type CreateDeveloperAppInput,
  createDeveloperAppSchema,
  creditsPricingResponseSchema,
  type DeveloperApp,
  developerAppListResponseSchema,
  developerAppResponseSchema,
  managedActionResponseSchema,
  meResponseSchema,
  registerProgramSchema,
  registeredProgramResponseSchema,
  sponsorWalletResponseSchema
} from "@celeris/shared";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const developerTokenStorageKey = "celeris.fs011.dashboard.token";
const developerTokenCookieName = "celeris_dashboard_session";

interface DeveloperSetupConsoleProps {
  apiOrigin: string;
  hostedAuthOrigin: string;
  developerAppOrigin: string;
  demoOrigin: string;
}

interface ProgramFormState {
  packageId: string;
}

interface ActionFormState {
  actionName: string;
  priceCredits: string;
  isEnabled: boolean;
}

interface CreditsPricingFormState {
  creditsPerUsd: string;
}

function normalizeOriginInput(value: string) {
  return new URL(value.trim()).origin;
}

function formatIntegerWithCommas(value: string | number) {
  const digits = String(value).replace(/\D/gu, "");
  return digits ? Number(digits).toLocaleString("en-US") : "";
}

function parseFormattedInteger(value: string) {
  return Number(value.replace(/,/gu, ""));
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

function getProfileInitial(email: string) {
  return (email.trim()[0] ?? "C").toUpperCase();
}

function shortenWalletAddress(walletAddress: string) {
  const normalized = walletAddress.trim();

  if (normalized.length <= 14) {
    return normalized || "Unavailable";
  }

  return `${normalized.slice(0, 6)}...${normalized.slice(-6)}`;
}

function formatSuiBalance(balanceMist: string | null | undefined) {
  if (!balanceMist) {
    return "Balance unavailable";
  }

  const mistPerSui = 1_000_000_000n;
  const mist = BigInt(balanceMist);
  const wholeSui = mist / mistPerSui;
  const fractionalMist = mist % mistPerSui;
  const fractional = fractionalMist.toString().padStart(9, "0").replace(/0+$/u, "");

  return `${wholeSui.toLocaleString("en-US")}${fractional ? `.${fractional}` : ""} SUI`;
}

function shortenValue(value: string) {
  const normalized = value.trim();

  if (normalized.length <= 18) {
    return normalized || "Unavailable";
  }

  return `${normalized.slice(0, 8)}...${normalized.slice(-6)}`;
}

function readCookie(name: string) {
  const cookies = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const cookie of cookies) {
    const [cookieName, ...rest] = cookie.split("=");

    if (cookieName === name) {
      return rest.join("=");
    }
  }

  return null;
}

export function DeveloperSetupConsole({
  apiOrigin,
  hostedAuthOrigin,
  developerAppOrigin,
  demoOrigin
}: DeveloperSetupConsoleProps) {
  const [token, setToken] = useState<string | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [developerEmail, setDeveloperEmail] = useState<string>("");
  const [developerWalletAddress, setDeveloperWalletAddress] = useState<string>("");
  const [apps, setApps] = useState<DeveloperApp[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [newAppName, setNewAppName] = useState("");
  const [programForm, setProgramForm] = useState<ProgramFormState>({
    packageId: ""
  });
  const [allowedOriginsInput, setAllowedOriginsInput] = useState("");
  const [actionForm, setActionForm] = useState<ActionFormState>({
    actionName: CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
    priceCredits: "",
    isEnabled: true
  });
  const [selectedActionType, setSelectedActionType] = useState<string | null>(null);
  const [creditsPricingForm, setCreditsPricingForm] = useState<CreditsPricingFormState>({
    creditsPerUsd: ""
  });
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Developer dashboard ready.");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedApp = useMemo(
    () => apps.find((app) => app.appId === selectedAppId) ?? null,
    [apps, selectedAppId]
  );
  const configuredActions = useMemo(() => {
    if (!selectedApp) {
      return [];
    }

    return selectedApp.actions.length > 0
      ? selectedApp.actions
      : selectedApp.sayHelloAction
        ? [selectedApp.sayHelloAction]
        : [];
  }, [selectedApp]);
  const selectedConfiguredAction = useMemo(
    () => configuredActions.find((action) => action.actionType === selectedActionType) ?? null,
    [configuredActions, selectedActionType]
  );

  useEffect(() => {
    const storedToken =
      window.sessionStorage.getItem(developerTokenStorageKey) ?? readCookie(developerTokenCookieName);

    if (storedToken) {
      window.sessionStorage.setItem(developerTokenStorageKey, storedToken);
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadSession(token);
    void loadApps(token);
  }, [token]);

  useEffect(() => {
    if (!selectedApp) {
      return;
    }

    setProgramForm({
      packageId: selectedApp.registeredProgram?.packageId ?? ""
    });
    setAllowedOriginsInput("");
    setActionForm({
      actionName: selectedConfiguredAction?.actionType ?? CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
      priceCredits: selectedConfiguredAction ? String(selectedConfiguredAction.priceCredits) : "5",
      isEnabled: selectedConfiguredAction?.isEnabled ?? true
    });
    setCreditsPricingForm({
      creditsPerUsd: formatIntegerWithCommas(selectedApp.creditsPricing.creditsPerUsd)
    });
  }, [selectedApp, selectedConfiguredAction]);

  useEffect(() => {
    setSelectedActionType(null);
  }, [selectedAppId]);

  async function request<T>(path: string, init: RequestInit, parser: { parse: (value: unknown) => T }) {
    const response = await fetch(new URL(path, apiOrigin), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {})
      }
    });

    if (response.status === 204) {
      return null as T;
    }

    const payload = (await response.json()) as unknown;

    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : `Request failed with status ${response.status}`;

      throw new Error(message);
    }

    return parser.parse(payload);
  }

  async function loadSession(activeToken: string) {
    try {
      const response = await fetch(new URL("/v1/me", apiOrigin), {
        headers: {
          authorization: `Bearer ${activeToken}`
        }
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error("Failed to load dashboard session");
      }

      const parsed = meResponseSchema.parse(payload);
      setDeveloperEmail(parsed.session.user.email);
      setDeveloperWalletAddress(parsed.session.user.walletAddress);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    }
  }

  async function loadApps(activeToken: string) {
    try {
      const response = await fetch(new URL("/v1/developer/apps", apiOrigin), {
        headers: {
          authorization: `Bearer ${activeToken}`
        }
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error("Failed to load apps");
      }

      const parsed = developerAppListResponseSchema.parse(payload);
      setApps(parsed.apps);
      setSelectedAppId((current) => current ?? parsed.apps[0]?.appId ?? null);
      setStatusMessage(parsed.apps.length === 0 ? "Create your first app to continue." : "Developer apps loaded.");
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    }
  }

  function updateSelectedApp(updatedApp: DeveloperApp) {
    setApps((current) => {
      const next = current.some((app) => app.appId === updatedApp.appId)
        ? current.map((app) => (app.appId === updatedApp.appId ? updatedApp : app))
        : [...current, updatedApp];

      return next;
    });
    setSelectedAppId(updatedApp.appId);
  }

  async function handleSignOut() {
    if (!token) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      await request(
        "/v1/auth/logout",
        {
          method: "POST"
        },
        {
          parse: () => null
        }
      );

      window.sessionStorage.removeItem(developerTokenStorageKey);
      document.cookie = `${developerTokenCookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
      window.location.href = new URL("/", developerAppOrigin).toString();
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function copyToClipboard(value: string, label: string) {
    if (!value) {
      return;
    }

    await navigator.clipboard.writeText(value);
    setStatusMessage(`${label} copied.`);
  }

  async function handleCreateApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setErrorMessage(null);

    try {
      const payload: CreateDeveloperAppInput = createDeveloperAppSchema.parse({
        name: newAppName
      });
      const response = await request(
        "/v1/developer/apps",
        {
          method: "POST",
          body: JSON.stringify(payload)
        },
        developerAppResponseSchema
      );

      updateSelectedApp(response.app);
      setStatusMessage(`Created app ${response.app.name}.`);
      setNewAppName("");
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function refreshApp(appId: string) {
    const response = await request(
      `/v1/developer/apps/${appId}`,
      {
        method: "GET"
      },
      developerAppResponseSchema
    );

    updateSelectedApp(response.app);
    return response.app;
  }

  async function handleProvisionSponsorWallet() {
    if (!selectedApp) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      await request(
        `/v1/developer/apps/${selectedApp.appId}/sponsor-wallet`,
        {
          method: "POST"
        },
        sponsorWalletResponseSchema
      );
      await refreshApp(selectedApp.appId);
      setStatusMessage("Sponsor wallet ready.");
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRegisterProgram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedApp) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const payload = registerProgramSchema.parse(programForm);
      await request(
        `/v1/developer/apps/${selectedApp.appId}/program`,
        {
          method: "PUT",
          body: JSON.stringify(payload)
        },
        registeredProgramResponseSchema
      );
      await refreshApp(selectedApp.appId);
      setStatusMessage("Registered Hello Celeris program metadata.");
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function saveAllowedOrigins(nextAllowedOrigins: string[]) {
    if (!selectedApp) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const payload = configureAllowedOriginsSchema.parse({
        allowedOrigins: nextAllowedOrigins
      });
      const response = await request(
        `/v1/developer/apps/${selectedApp.appId}/allowed-origins`,
        {
          method: "PUT",
          body: JSON.stringify(payload)
        },
        developerAppResponseSchema
      );
      updateSelectedApp(response.app);
      setStatusMessage("Updated allowed origins.");
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAddAllowedOrigin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedApp) {
      return;
    }

    try {
      const origin = normalizeOriginInput(allowedOriginsInput);
      await saveAllowedOrigins(Array.from(new Set([...selectedApp.allowedOrigins, origin])));
      setAllowedOriginsInput("");
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    }
  }

  async function handleRemoveAllowedOrigin(origin: string) {
    if (!selectedApp) {
      return;
    }

    await saveAllowedOrigins(selectedApp.allowedOrigins.filter((candidate) => candidate !== origin));
  }

  async function handleConfigureAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedApp) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const actionType = actionForm.actionName.trim();
      const payload: ConfigureManagedActionInput = configureManagedActionSchema.parse({
        priceCredits: Number(actionForm.priceCredits),
        isEnabled: actionForm.isEnabled
      });
      await request(
        `/v1/developer/apps/${selectedApp.appId}/actions/${encodeURIComponent(actionType)}`,
        {
          method: "PUT",
          body: JSON.stringify(payload)
        },
        managedActionResponseSchema
      );
      await refreshApp(selectedApp.appId);
      setStatusMessage(`Updated ${actionType} action.`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  function selectConfiguredAction(action: (typeof configuredActions)[number]) {
    setSelectedActionType(action.actionType);
    setActionForm({
      actionName: action.actionType,
      priceCredits: String(action.priceCredits),
      isEnabled: action.isEnabled
    });
  }

  async function handleConfigureCreditsPricing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedApp) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const payload: ConfigureCreditsPricingInput = configureCreditsPricingSchema.parse({
        creditsPerUsd: parseFormattedInteger(creditsPricingForm.creditsPerUsd)
      });
      await request(
        `/v1/developer/apps/${selectedApp.appId}/credits-pricing`,
        {
          method: "PUT",
          body: JSON.stringify(payload)
        },
        creditsPricingResponseSchema
      );
      await refreshApp(selectedApp.appId);
      setStatusMessage("Updated credits pricing.");
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  function updateProgramField(field: keyof ProgramFormState) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setProgramForm((current) => ({
        ...current,
        [field]: value
      }));
    };
  }

  function updateCreditsPricingField(event: ChangeEvent<HTMLInputElement>) {
    setCreditsPricingForm({
      creditsPerUsd: formatIntegerWithCommas(event.target.value)
    });
  }

  function updateActionField(field: keyof ActionFormState) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
      setActionForm((current) => ({
        ...current,
        [field]: value
      }));
    };
  }

  return (
    <main className="developer-console mx-auto grid max-w-7xl gap-4 px-5 py-5 md:gap-5 md:px-6">
      <Card className="workspace-header">
        <div className="workspace-header-copy">
          <p className="workspace-kicker">CELERIS</p>
          <h1>Developer Console</h1>
          <p className="workspace-copy">
            Configure metered actions, sponsor wallets, and runtime settings for a calmer onchain user experience.
          </p>
        </div>
        <div className="profile-menu">
          <Button
            aria-expanded={isProfileMenuOpen}
            aria-haspopup="menu"
            aria-label="Developer profile"
            className="profile-avatar-button"
            onClick={() => setIsProfileMenuOpen((current) => !current)}
            type="button"
            variant="ghost"
          >
            {getProfileInitial(developerEmail)}
          </Button>
          {isProfileMenuOpen ? (
            <div className="profile-menu-panel" role="menu">
              <div className="profile-menu-identity">
                <div className="profile-menu-avatar" aria-hidden="true">
                  {getProfileInitial(developerEmail)}
                </div>
                <div>
                  <p>{developerEmail || "Unavailable"}</p>
                  <span title={developerWalletAddress || "Unavailable"}>{shortenWalletAddress(developerWalletAddress)}</span>
                </div>
              </div>
              <Button className="profile-menu-item" onClick={handleSignOut} role="menuitem" type="button" disabled={isBusy || !token} variant="ghost">
                Sign out
              </Button>
            </div>
          ) : null}
        </div>
      </Card>

      <section className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Apps</CardTitle>
              <CardDescription>Create and select an app.</CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form className="grid gap-3" onSubmit={handleCreateApp}>
              <Label>
                <span>App name</span>
                <Input name="name" onChange={(event) => setNewAppName(event.target.value)} type="text" value={newAppName} />
              </Label>
              <Button disabled={isBusy || !token} type="submit">
                Create app
              </Button>
            </form>

            <div className="grid gap-2 pt-1" role="list" aria-label="Developer apps">
              {apps.length === 0 ? <p className="empty-state">No apps yet.</p> : null}
              {apps.map((app) => (
                <button
                  aria-pressed={selectedAppId === app.appId}
                  className={`list-row${selectedAppId === app.appId ? " selected" : ""} rounded-md`}
                  key={app.appId}
                  onClick={() => setSelectedAppId(app.appId)}
                  type="button"
                >
                  <span>{app.name}</span>
                  <small>{app.appId}</small>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="items-start max-md:flex-col">
            <div className="min-w-0">
              <CardTitle>
                App configuration{selectedApp ? <> for <span className="italic">{selectedApp.name}</span></> : null}
              </CardTitle>
              <CardDescription>{selectedApp ? "Runtime settings and Sui package registration." : "Choose an app to continue."}</CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            {selectedApp ? (
              <>
                <dl className="grid gap-3 rounded-md border border-[rgba(23,34,31,0.12)] bg-white/55 p-4 md:grid-cols-2">
                  <div className="grid gap-1">
                    <dt>App ID:</dt>
                    <dd className="flex min-w-0 items-center gap-2">
                      <span className="truncate" title={selectedApp.appId}>{shortenValue(selectedApp.appId)}</span>
                      <Button className="h-7 min-h-7 shrink-0 px-2 text-xs" onClick={() => void copyToClipboard(selectedApp.appId, "App ID")} type="button" variant="secondary">
                        Copy
                      </Button>
                    </dd>
                  </div>
                  <div className="grid gap-1">
                    <dt>Network:</dt>
                    <dd>{selectedApp.allowedChainId}</dd>
                  </div>
                  <div className="grid gap-1">
                    <dt>Auth provider:</dt>
                    <dd>{selectedApp.authProvider}</dd>
                  </div>
                  <div className="grid gap-1">
                    <dt>Sponsor wallet:</dt>
                    <dd className="flex min-w-0 items-center gap-2">
                      <span className="truncate" title={selectedApp.sponsorWallet?.address ?? "Not provisioned yet"}>
                        {selectedApp.sponsorWallet?.address ? shortenWalletAddress(selectedApp.sponsorWallet.address) : <Button
                          className="shrink-0"
                          variant="secondary"
                          disabled={!selectedApp || isBusy}
                          onClick={handleProvisionSponsorWallet}
                          type="button"
                        >
                          Generate
                        </Button>}
                      </span>
                      {selectedApp.sponsorWallet?.address ? (
                        <Button className="h-7 min-h-7 shrink-0 px-2 text-xs" onClick={() => void copyToClipboard(selectedApp.sponsorWallet?.address ?? "", "Sponsor wallet")} type="button" variant="secondary">
                          Copy
                        </Button>
                      ) : null}
                      {selectedApp.sponsorWallet?.address ? (
                        <span className="shrink-0 text-xs font-medium text-[#55635d]" aria-label="Sponsor wallet SUI balance">
                          {formatSuiBalance(selectedApp.sponsorWallet.suiBalanceMist)}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                </dl>

                <div className="grid gap-5">
                  <dl className="grid gap-3 rounded-md border border-[rgba(23,34,31,0.12)] bg-white/55 p-4 md:grid-cols-1">
                    <form className="grid gap-3" onSubmit={handleRegisterProgram}>
                      <div>
                        <h3 className="text-base font-semibold">Deployed Sui package</h3>
                        <p className="mt-1 text-sm text-[#55635d]">Register the package used by sponsored actions.</p>
                      </div>
                      <Label>
                        <span>Package ID</span>
                        <Input onChange={updateProgramField("packageId")} type="text" value={programForm.packageId} />
                      </Label>
                      <Button className="justify-self-start" disabled={isBusy} type="submit">
                        Save package ID
                      </Button>
                    </form>
                  </dl>

                  <dl className="grid gap-3 rounded-md border border-[rgba(23,34,31,0.12)] bg-white/55 p-4 md:grid-cols-1">
                    <div className="grid gap-3">
                      <div>
                        <h3 className="text-base font-semibold">Allowed Origins</h3>
                      </div>
                      {selectedApp.allowedOrigins.length > 0 ? (
                        <div className="flex flex-wrap gap-2" aria-label="Saved allowed origins">
                          {selectedApp.allowedOrigins.map((origin) => (
                            <span
                              className="inline-flex max-w-full items-center gap-2 rounded-md border border-[rgba(23,34,31,0.12)] bg-white/75 px-2.5 py-1 text-sm"
                              key={origin}
                            >
                              <span className="min-w-0 break-all">{origin}</span>
                              <button
                                aria-label={`Remove origin ${origin}`}
                                className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-base leading-none text-[#55635d] hover:bg-[rgba(23,34,31,0.08)] hover:text-[#17221f] disabled:opacity-50"
                                disabled={isBusy}
                                onClick={() => void handleRemoveAllowedOrigin(origin)}
                                type="button"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <form className="grid gap-3" onSubmit={handleAddAllowedOrigin}>
                        <Label>
                          <span>Add in the domain/s of your dApp (ex: https://demo.celeris.pro).</span>
                          <Input
                            name="allowedOrigin"
                            onChange={(event) => setAllowedOriginsInput(event.target.value)}
                            type="url"
                            value={allowedOriginsInput}
                          />
                        </Label>
                        <Button className="justify-self-start" disabled={isBusy} type="submit">
                          Add Origin
                        </Button>
                      </form>
                    </div>
                  </dl>
                  <dl className="grid gap-3 rounded-md border border-[rgba(23,34,31,0.12)] bg-white/55 p-4 md:grid-cols-1">
                    <form id="credits-pricing-form" className="grid gap-3" onSubmit={handleConfigureCreditsPricing}>
                      <div>
                        <h3 className="text-base font-semibold">Credits Pricing</h3>
                      </div>
                      <Label>
                        <span>Credits per 1$</span>
                        <Input
                          inputMode="numeric"
                          min={1}
                          onChange={updateCreditsPricingField}
                          pattern="[0-9,]*"
                          type="text"
                          value={creditsPricingForm.creditsPerUsd}
                        />
                      </Label>
                      <Button className="justify-self-start" disabled={isBusy} type="submit">
                        Save pricing
                      </Button>
                    </form>
                  </dl>
                </div>
              </>
            ) : (
              <p className="empty-state">Create or select an app to configure the slice.</p>
            )}

          </CardContent>
        </Card>
      </section>
      <section className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Card className="flex items-start justify-between gap-4 p-4 max-md:flex-col">
          <div>
            <h2 className="text-sm font-semibold">Status</h2>
            <p className="mt-1 text-sm text-[#55635d]">{statusMessage}</p>
          </div>
          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        </Card>
        <Card>
          <CardHeader className="items-start max-md:flex-col">
            <div className="min-w-0">
              <CardTitle>
                Allowed user actions
              </CardTitle>
              <CardDescription>Add/Configure metered user actions here.</CardDescription>
            </div>
          </CardHeader>

          <CardContent id="user-actions-configuration">
            {selectedApp ? (
              <>
                <div className="grid gap-5">
                  <form className="grid gap-3 xl:grid-cols-[minmax(10rem,1fr)_10rem_8rem_auto]" onSubmit={handleConfigureAction}>
                    <Label>
                      <span>Action name</span>
                      <Input onChange={updateActionField("actionName")} type="text" value={actionForm.actionName} />
                    </Label>
                    <Label>
                      <span>Credit usage</span>
                      <Input
                        min={0}
                        onChange={updateActionField("priceCredits")}
                        step={1}
                        type="number"
                        value={actionForm.priceCredits}
                      />
                    </Label>
                    <Label className="self-end rounded-md border border-[rgba(23,34,31,0.12)] bg-white/55 px-3 py-2">
                      <span>Enabled</span>
                      <input
                        checked={actionForm.isEnabled}
                        className="h-4 w-4"
                        onChange={updateActionField("isEnabled")}
                        type="checkbox"
                      />
                    </Label>
                    <Button className="self-end" disabled={isBusy} type="submit">
                      {selectedConfiguredAction ? "Update" : "Create Action"}
                    </Button>
                  </form>
                </div>
                <div className="grid gap-3">
                  <h3 className="text-base font-semibold">Configured actions</h3>
                  {configuredActions.length > 0 ? (
                    configuredActions.map((action) => (
                      <button
                        aria-pressed={selectedActionType === action.actionType}
                        className={`list-row action-list-row rounded-md${selectedActionType === action.actionType ? " selected" : ""}`}
                        key={action.actionType}
                        onClick={() => selectConfiguredAction(action)}
                        type="button"
                      >
                        <div>
                          <span>{action.actionType}</span>
                          <small>  cost: {action.priceCredits} credits</small>
                        </div>
                        <small>{action.isEnabled ? "Enabled" : "Disabled"}</small>
                      </button>
                    ))
                  ) : (
                    <p className="empty-state">No user actions configured yet.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="empty-state">Create or select an app to configure the slice.</p>
            )}

          </CardContent>
        </Card>
      </section>

    </main>
  );
}
