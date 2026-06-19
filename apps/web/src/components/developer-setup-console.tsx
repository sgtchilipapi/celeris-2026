"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
  type ConfigureManagedActionInput,
  type ConfigureCreditsPricingInput,
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
    setActionForm({
      actionName: selectedConfiguredAction?.actionType ?? CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
      priceCredits: selectedConfiguredAction ? String(selectedConfiguredAction.priceCredits) : "5",
      isEnabled: selectedConfiguredAction?.isEnabled ?? true
    });
    setCreditsPricingForm({
      creditsPerUsd: String(selectedApp.creditsPricing.creditsPerUsd)
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
        creditsPerUsd: Number(creditsPricingForm.creditsPerUsd)
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
      creditsPerUsd: event.target.value
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
    <main className="mx-auto grid max-w-7xl gap-4 px-5 py-5 md:gap-5 md:px-6">
      <Card className="workspace-header">
        <div className="workspace-header-copy">
          <p className="workspace-kicker">CELERIS</p>
          <h1>Developer Console</h1>
          <p className="workspace-copy">
            This is the place to get your amazing app provide the smoothest user experience.
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
                    </dd>
                  </div>
                </dl>

                <div className="grid gap-5">
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

                  <form id="credits-pricing-form" className="grid content-start gap-3 rounded-md border border-[rgba(23,34,31,0.12)] bg-white/55 p-4" onSubmit={handleConfigureCreditsPricing}>
                    <div>
                      <h3 className="text-base font-semibold">Credits Pricing</h3>
                    </div>
                    <Label>
                      <span>Credits per 1$</span>
                      <Input
                        min={1}
                        onChange={updateCreditsPricingField}
                        step={1}
                        type="number"
                        value={creditsPricingForm.creditsPerUsd}
                      />
                    </Label>
                    <Button disabled={isBusy} type="submit">
                      Save pricing
                    </Button>
                  </form>
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
                        aria-label={`${action.actionType}, cost: ${action.priceCredits} credits, ${action.isEnabled ? "enabled" : "disabled"}`}
                        aria-pressed={selectedActionType === action.actionType}
                        className={`list-row action-list-row rounded-md${selectedActionType === action.actionType ? " selected" : ""}`}
                        key={action.actionType}
                        onClick={() => selectConfiguredAction(action)}
                        type="button"
                      >
                        <span>{action.actionType}</span>
                        <span>cost: {action.priceCredits} credits</span>
                        <span>{action.isEnabled ? "enabled" : "disabled"}</span>
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
