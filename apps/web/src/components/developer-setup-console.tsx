"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  type ConfigureSayHelloInput,
  configureSayHelloSchema,
  type CreateDeveloperAppInput,
  createDeveloperAppSchema,
  type DeveloperApp,
  developerAppListResponseSchema,
  developerAppResponseSchema,
  managedActionResponseSchema,
  meResponseSchema,
  registerProgramSchema,
  registeredProgramResponseSchema,
  sponsorWalletResponseSchema
} from "@celeris/shared";

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
  appStateObjectId: string;
  authorityCapObjectId: string;
}

interface ActionFormState {
  priceCredits: string;
  isEnabled: boolean;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
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
  const [developerEmail, setDeveloperEmail] = useState<string>("");
  const [developerWalletAddress, setDeveloperWalletAddress] = useState<string>("");
  const [apps, setApps] = useState<DeveloperApp[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [newAppName, setNewAppName] = useState("Hello Celeris Demo");
  const [programForm, setProgramForm] = useState<ProgramFormState>({
    packageId: "",
    appStateObjectId: "",
    authorityCapObjectId: ""
  });
  const [actionForm, setActionForm] = useState<ActionFormState>({
    priceCredits: "5",
    isEnabled: true
  });
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Developer dashboard ready.");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedApp = useMemo(
    () => apps.find((app) => app.appId === selectedAppId) ?? null,
    [apps, selectedAppId]
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
      packageId: selectedApp.registeredProgram?.packageId ?? "",
      appStateObjectId: selectedApp.registeredProgram?.appStateObjectId ?? "",
      authorityCapObjectId: selectedApp.registeredProgram?.authorityCapObjectId ?? ""
    });
    setActionForm({
      priceCredits: selectedApp.sayHelloAction ? String(selectedApp.sayHelloAction.priceCredits) : "5",
      isEnabled: selectedApp.sayHelloAction?.isEnabled ?? true
    });
  }, [selectedApp]);

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
      const payload: ConfigureSayHelloInput = configureSayHelloSchema.parse({
        priceCredits: Number(actionForm.priceCredits),
        isEnabled: actionForm.isEnabled
      });
      await request(
        `/v1/developer/apps/${selectedApp.appId}/actions/say_hello`,
        {
          method: "PUT",
          body: JSON.stringify(payload)
        },
        managedActionResponseSchema
      );
      await refreshApp(selectedApp.appId);
      setStatusMessage("Updated say_hello pricing.");
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

  return (
    <main className="workspace">
      <section className="workspace-header">
        <div>
          <p className="workspace-kicker">FS-01.1 Developer Surface Realignment</p>
          <h1>Developer dashboard</h1>
          <p className="workspace-copy">
            Shared auth is hosted on the auth origin. This dashboard is the reserved first-party client and the demo
            origin is now kept for the SDK consumer app.
          </p>
        </div>
        <dl className="runtime-grid">
          <div>
            <dt>Dashboard origin</dt>
            <dd>{developerAppOrigin}</dd>
          </div>
          <div>
            <dt>Demo origin</dt>
            <dd>{demoOrigin}</dd>
          </div>
          <div>
            <dt>Auth origin</dt>
            <dd>{hostedAuthOrigin}</dd>
          </div>
          <div>
            <dt>API origin</dt>
            <dd>{apiOrigin}</dd>
          </div>
        </dl>
      </section>

      <section className="workspace-band">
        <div className="band-header">
          <div>
            <h2>Developer session</h2>
            <p>{developerEmail ? `Signed in as ${developerEmail}` : "Waiting for dashboard session."}</p>
          </div>
          <button className="button secondary" onClick={handleSignOut} type="button" disabled={isBusy || !token}>
            Sign out
          </button>
        </div>

        <dl className="runtime-grid">
          <div>
            <dt>Email</dt>
            <dd>{developerEmail || "Unavailable"}</dd>
          </div>
          <div>
            <dt>Wallet</dt>
            <dd>{developerWalletAddress || "Unavailable"}</dd>
          </div>
        </dl>
      </section>

      <section className="workspace-grid">
        <section className="workspace-band">
          <div className="band-header">
            <div>
              <h2>Apps</h2>
              <p>Create and select the app you want to configure.</p>
            </div>
          </div>

          <form className="form-grid compact" onSubmit={handleCreateApp}>
            <label>
              <span>App name</span>
              <input name="name" onChange={(event) => setNewAppName(event.target.value)} type="text" value={newAppName} />
            </label>
            <button className="button" disabled={isBusy || !token} type="submit">
              Create app
            </button>
          </form>

          <div className="list-stack" role="list" aria-label="Developer apps">
            {apps.length === 0 ? <p className="empty-state">No apps yet.</p> : null}
            {apps.map((app) => (
              <button
                aria-pressed={selectedAppId === app.appId}
                className={`list-row${selectedAppId === app.appId ? " selected" : ""}`}
                key={app.appId}
                onClick={() => setSelectedAppId(app.appId)}
                type="button"
              >
                <span>{app.name}</span>
                <small>{app.appId}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="workspace-band">
          <div className="band-header">
            <div>
              <h2>App configuration</h2>
              <p>{selectedApp ? selectedApp.name : "Choose an app to continue."}</p>
            </div>
            <button
              className="button secondary"
              disabled={!selectedApp || isBusy}
              onClick={handleProvisionSponsorWallet}
              type="button"
            >
              Provision sponsor wallet
            </button>
          </div>

          {selectedApp ? (
            <>
              <dl className="runtime-grid">
                <div>
                  <dt>App ID</dt>
                  <dd>{selectedApp.appId}</dd>
                </div>
                <div>
                  <dt>Allowed chain</dt>
                  <dd>{selectedApp.allowedChainId}</dd>
                </div>
                <div>
                  <dt>Auth provider</dt>
                  <dd>{selectedApp.authProvider}</dd>
                </div>
                <div>
                  <dt>Sponsor wallet</dt>
                  <dd>{selectedApp.sponsorWallet?.address ?? "Not provisioned yet"}</dd>
                </div>
              </dl>

              <form className="form-grid" onSubmit={handleRegisterProgram}>
                <h3>Program registration</h3>
                <label>
                  <span>Package ID</span>
                  <input onChange={updateProgramField("packageId")} type="text" value={programForm.packageId} />
                </label>
                <label>
                  <span>AppState object ID</span>
                  <input
                    onChange={updateProgramField("appStateObjectId")}
                    type="text"
                    value={programForm.appStateObjectId}
                  />
                </label>
                <label>
                  <span>Authority capability object ID</span>
                  <input
                    onChange={updateProgramField("authorityCapObjectId")}
                    type="text"
                    value={programForm.authorityCapObjectId}
                  />
                </label>
                <button className="button" disabled={isBusy} type="submit">
                  Save program IDs
                </button>
              </form>

              <form className="form-grid compact" onSubmit={handleConfigureAction}>
                <h3>say_hello pricing</h3>
                <label>
                  <span>Price in credits</span>
                  <input
                    min={0}
                    onChange={(event) => setActionForm((current) => ({ ...current, priceCredits: event.target.value }))}
                    type="number"
                    value={actionForm.priceCredits}
                  />
                </label>
                <label className="checkbox-row">
                  <input
                    checked={actionForm.isEnabled}
                    onChange={(event) => setActionForm((current) => ({ ...current, isEnabled: event.target.checked }))}
                    type="checkbox"
                  />
                  <span>Enabled</span>
                </label>
                <button className="button" disabled={isBusy} type="submit">
                  Save action
                </button>
              </form>

              <section className="snippet-block" aria-label="SDK config">
                <h3>SDK config</h3>
                <pre>{JSON.stringify(selectedApp.sdkConfig, null, 2)}</pre>
              </section>
            </>
          ) : (
            <p className="empty-state">Create or select an app to configure the slice.</p>
          )}
        </section>
      </section>

      <section className="workspace-band status-band">
        <div>
          <h2>Status</h2>
          <p>{statusMessage}</p>
        </div>
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      </section>
    </main>
  );
}
