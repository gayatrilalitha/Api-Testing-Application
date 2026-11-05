
"use strict";

/* =====================================
   1. CONFIGURATION
===================================== */

const API_BASE_URL = "http://localhost:9000/api";
const TOKEN_KEY = "apiTesterToken";
const USER_KEY = "apiTesterUser";

/* =====================================
   2. DOM ELEMENTS
===================================== */

const $ = (selector) => document.querySelector(selector);

const methodSelect = $("#method");
const urlInput = $("#url");
const sendButton = $("#sendRequest");
const clearButton = $("#clearRequest");

const paramsContainer = $("#paramsContainer");
const headersContainer = $("#headersContainer");

const addParamButton = $("#addParam");
const addHeaderButton = $("#addHeader");

const requestBody = $("#requestBody");
const responseOutput = $("#response");

const statusOutput = $("#status");
const responseTimeOutput = $("#responseTime");
const resolvedUrlOutput = $("#resolvedUrl");

/* Authentication elements */
const loginForm = $("#loginForm");
const signupForm = $("#signupForm");
const authMessage = $("#authMessage");

/* =====================================
   3. AUTHENTICATION HELPERS
===================================== */

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function getUser() {
    try {
        return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
        return null;
    }
}

function saveSession(data) {
    if (!data.token || !data.user) {
        throw new Error("The server did not return a token and user.");
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

/* =====================================
   4. API HELPER
   Adds JWT to protected requests
===================================== */

async function apiRequest(path, options = {}) {
    const headers = {
        ...(options.headers || {})
    };

    if (options.body !== undefined && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    const token = getToken();

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    if (response.status === 401) {
        clearSession();
    }

    if (!response.ok) {
        const message =
            typeof data === "object" && data !== null
                ? data.message || "Request failed"
                : data || "Request failed";

        throw new Error(message);
    }

    return data;
}


/* =====================================
   VARIABLE SUBSTITUTION
===================================== */

// Load saved variables from the backend
async function getSavedVariables() {
    const data = await apiRequest("/variables");

    const variables = Array.isArray(data)
        ? data
        : data.variables || [];

    const variableMap = {};

    variables.forEach((item) => {
        variableMap[item.var_key] = item.var_value;
    });

    return variableMap;
}

// Replace {{variableName}} with its saved value
function replaceVariables(text, variables) {
    return String(text).replace(
        /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g,
        (match, key) => {
            if (!Object.prototype.hasOwnProperty.call(variables, key)) {
                throw new Error(
                    `Variable "{{${key}}}" is not defined. Please save it first.`
                );
            }

            return variables[key];
        }
    );
}


/* =====================================
   5. AUTHENTICATION MESSAGE
===================================== */

function showAuthMessage(message, isError = false) {
    if (!authMessage) return;

    authMessage.textContent = message;
    authMessage.style.color = isError ? "red" : "green";
}

/* =====================================
   6. LOGIN
===================================== */

loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = $("#loginEmail").value.trim();
    const password = $("#loginPassword").value;

    showAuthMessage("Logging in...");

    try {
        const data = await apiRequest("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });

        saveSession(data);

        showAuthMessage("Login successful!");

        updateAccountInfo();
        showView("dashboard");

        // Later, we'll load history, variables and performance here.
    } catch (error) {
        showAuthMessage(error.message, true);
    }
});

/* =====================================
   7. SIGNUP
===================================== */

signupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = $("#signupUsername").value.trim();
    const email = $("#signupEmail").value.trim();
    const password = $("#signupPassword").value;

    showAuthMessage("Creating your account...");

    try {
        const data = await apiRequest("/auth/signup", {
            method: "POST",
            body: JSON.stringify({ username, email, password })
        });

        // Some signup APIs return only a success message.
        // If signup returns a token and user, log in automatically.
        if (data.token && data.user) {
            saveSession(data);
            updateAccountInfo();
            showView("dashboard");
            showAuthMessage("Account created successfully!");
        } else {
            showAuthMessage("Signup successful. Please log in.");
            showAuthTab("login");
        }
    } catch (error) {
        showAuthMessage(error.message, true);
    }
});

/* =====================================
   8. LOGIN / SIGNUP TABS
===================================== */

function showAuthTab(tab) {
    if (!loginForm || !signupForm) return;

    loginForm.hidden = tab !== "login";
    signupForm.hidden = tab !== "signup";
}

document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => {
        showAuthTab(button.dataset.authTab);
        showAuthMessage("");
    });
});

/* =====================================
   9. PAGE NAVIGATION
===================================== */

function showView(viewId) {
    const view = document.getElementById(viewId);

    if (!view || !view.classList.contains("view")) {
        return;
    }

    document.querySelectorAll(".view").forEach((section) => {
        section.hidden = section.id !== viewId;
    });
}


document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
        const viewId = button.dataset.view;

        // Always allow the user to open Login / Signup.
        if (viewId === "auth") {
            showView("auth");
            showAuthMessage("");
            return;
        }

        // Require login for the other sections.
        if (!getToken()) {
            showView("auth");
            showAuthMessage("Please log in to access this section.", true);
            return;
        }

        showView(viewId);
    });
});

/* =====================================
   10. ACCOUNT INFORMATION
===================================== */

function updateAccountInfo() {
    const accountInfo = $("#accountInfo");
    if (!accountInfo) return;

    const user = getUser();

    accountInfo.textContent = user
        ? `Logged in as ${user.username} (${user.email})`
        : "Please log in to view your account settings.";
}

/* =====================================
   11. LOGOUT
===================================== */

$("#logoutButton")?.addEventListener("click", () => {
    clearSession();
    updateAccountInfo();
    showView("auth");
    showAuthMessage("You have logged out successfully.");
});

/* =====================================
   12. QUERY PARAMETER ROWS
===================================== */

function addParamRow(key = "", value = "") {
    const row = document.createElement("div");
    row.className = "param-row";

    const keyInput = document.createElement("input");
    keyInput.placeholder = "Parameter name";
    keyInput.value = key;
    keyInput.className = "param-key";
    keyInput.setAttribute("aria-label", "Parameter name");

    const valueInput = document.createElement("input");
    valueInput.placeholder = "Parameter value";
    valueInput.value = value;
    valueInput.className = "param-value";
    valueInput.setAttribute("aria-label", "Parameter value");

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Remove";

    removeButton.addEventListener("click", () => {
        row.remove();
        syncParamsToUrl();
    });

    keyInput.addEventListener("input", syncParamsToUrl);
    valueInput.addEventListener("input", syncParamsToUrl);

    row.append(keyInput, valueInput, removeButton);
    paramsContainer.appendChild(row);
}

/* =====================================
   13. REQUEST HEADER ROWS
===================================== */

function addHeaderRow(key = "", value = "") {
    const row = document.createElement("div");
    row.className = "header-row";

    const keyInput = document.createElement("input");
    keyInput.placeholder = "Header name";
    keyInput.value = key;
    keyInput.className = "header-key";
    keyInput.setAttribute("aria-label", "Header name");

    const valueInput = document.createElement("input");
    valueInput.placeholder = "Header value";
    valueInput.value = value;
    valueInput.className = "header-value";
    valueInput.setAttribute("aria-label", "Header value");

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Remove";

    removeButton.addEventListener("click", () => row.remove());

    row.append(keyInput, valueInput, removeButton);
    headersContainer.appendChild(row);
}

/* =====================================
   14. READ PARAMS AND HEADERS
===================================== */

function getParamsObject() {
    const params = {};

    document.querySelectorAll(".param-row").forEach((row) => {
        const key = row.querySelector(".param-key").value.trim();
        const value = row.querySelector(".param-value").value;

        if (key) params[key] = value;
    });

    return params;
}

function getHeadersObject() {
    const headers = {};

    document.querySelectorAll(".header-row").forEach((row) => {
        const key = row.querySelector(".header-key").value.trim();
        const value = row.querySelector(".header-value").value;

        if (key) headers[key] = value;
    });

    return headers;
}

/* =====================================
   15. URL / PARAMETER SYNCHRONIZATION
===================================== */

function syncUrlToParams() {
    const url = urlInput.value.trim();
    if (!url) return;

    try {
        const parsedUrl = new URL(url);
        paramsContainer.replaceChildren();

        parsedUrl.searchParams.forEach((value, key) => {
            addParamRow(key, value);
        });

        updateResolvedUrl();
    } catch {
        // Wait until the URL is valid.
    }
}

function syncParamsToUrl() {
    const originalUrl = urlInput.value.trim();
    if (!originalUrl) return;

    try {
        const parsedUrl = new URL(originalUrl);
        parsedUrl.search = "";

        Object.entries(getParamsObject()).forEach(([key, value]) => {
            parsedUrl.searchParams.append(key, value);
        });

        urlInput.value = parsedUrl.toString();
        updateResolvedUrl();
    } catch {
        // Ignore invalid URLs while the user is typing.
    }
}

function updateResolvedUrl() {
    if (resolvedUrlOutput) {
        resolvedUrlOutput.textContent =
            "Resolved URL: " + urlInput.value.trim();
    }
}

/* =====================================
   16. REQUEST AND RESPONSE TABS
===================================== */

document.querySelectorAll("[data-request-tab]").forEach((button) => {
    button.addEventListener("click", () => {
        const selected = button.dataset.requestTab;

        $("#paramsPanel").hidden = selected !== "params";
        $("#headersPanel").hidden = selected !== "headers";
        $("#bodyPanel").hidden = selected !== "body";
    });
});

/* =====================================
   17. RESPONSE DISPLAY MODE
===================================== */

let latestResponse = null;
let latestResponseHeaders = {};

document.querySelectorAll("[data-response-tab]").forEach((button) => {
    button.addEventListener("click", () => {
        if (!latestResponse) return;

        const tab = button.dataset.responseTab;

        if (tab === "headers") {
            responseOutput.textContent = JSON.stringify(
                latestResponseHeaders,
                null,
                2
            );
        } else if (tab === "raw") {
            responseOutput.textContent =
                typeof latestResponse === "string"
                    ? latestResponse
                    : JSON.stringify(latestResponse, null, 2);
        } else {
            responseOutput.textContent = JSON.stringify(
                latestResponse,
                null,
                2
            );
        }
    });
});

/* =====================================
   18. CLEAR REQUEST
===================================== */

function clearRequest() {
    methodSelect.value = "GET";
    urlInput.value = "";

    paramsContainer.replaceChildren();
    headersContainer.replaceChildren();

    requestBody.value = "";

    latestResponse = null;
    latestResponseHeaders = {};

    responseOutput.textContent =
        'Click "Send" to execute the request.';

    statusOutput.textContent = "-";
    responseTimeOutput.textContent = "-";

    updateResolvedUrl();
}

/* =====================================
   19. EVENT LISTENERS
===================================== */

$("#requestForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendRequest();
});

clearButton?.addEventListener("click", clearRequest);

addParamButton?.addEventListener("click", () => addParamRow());
addHeaderButton?.addEventListener("click", () => addHeaderRow());

urlInput?.addEventListener("change", syncUrlToParams);

/* =====================================
   20. API REQUEST PLACEHOLDER
   Implemented in Part 2
===================================== */


async function sendRequest() {
    const method = methodSelect.value;
    let url = urlInput.value.trim();
    let headers = getHeadersObject();

    if (!getToken()) {
        showView("auth");
        showAuthMessage("Please log in before sending API requests.", true);
        return;
    }

    if (!url) {
        alert("Please enter an API URL.");
        return;
    }
    let savedVariables = {};
    
try {
    // Load variables saved by the logged-in user
     savedVariables = await getSavedVariables();

    // Resolve variables in the URL
    url = replaceVariables(url, savedVariables);

    // Resolve variables in header names and values
    const resolvedHeaders = {};

    for (const [key, value] of Object.entries(headers)) {
        resolvedHeaders[replaceVariables(key, savedVariables)] =
            replaceVariables(value, savedVariables);
    }

    headers = resolvedHeaders;

    // Validate the resolved URL
    new URL(url);
} catch (error) {
    alert(`Unable to resolve request: ${error.message}`);
    return;
}


    // Build request data for the backend.
    const requestData = {
        method,
        url,
        headers
    };

    if (["POST", "PUT", "PATCH"].includes(method)) {
        const bodyText = requestBody.value.trim();

        if (bodyText) {
           try {
               const resolvedBody = replaceVariables(
                    bodyText,
                    savedVariables
                );

                 requestData.body = JSON.parse(resolvedBody);

                } catch (error) {
                   alert(`Invalid request body or variable: ${error.message}`);
                   return;
                }
        }
    }

    sendButton.disabled = true;
    sendButton.textContent = "Sending...";
    responseOutput.textContent = "Sending request...";
    statusOutput.textContent = "-";
    responseTimeOutput.textContent = "-";

    const startTime = performance.now();
    let status = 0;
    let latency = 0;

    try {
        const data = await apiRequest("/test", {
            method: "POST",
            body: JSON.stringify(requestData)
        });

        latency = Number(data.responseTime);
        console.log("Backend response time:", data.responseTime);
        console.log("Latency saved by frontend:", latency);
        status = Number(data.status) || 0;

        statusOutput.textContent = status || "Unknown";
        responseTimeOutput.textContent = `${latency} ms`;

        latestResponse = data.data ?? data;
        latestResponseHeaders = data.headers ?? {};

        responseOutput.textContent = JSON.stringify(
            latestResponse,
            null,
            2
        );

        // Save request history.
        try {
            await apiRequest("/history", {
                method: "POST",
                body: JSON.stringify({
                    method,
                    url,
                    status: status || null,
                    responseTime: latency
                })
            });
        } catch (error) {
            console.error("Could not save request history:", error.message);
        }

        // Save performance data.
        if (status >= 100 && status <= 599) {
            try {
                await apiRequest("/performance", {
                    method: "POST",
                    body: JSON.stringify({
                        method,
                        url,
                        status,
                        latency
                    })
                });
            } catch (error) {
                console.error("Could not save performance data:", error.message);
            }
        }

    } catch (error) {
        latency = Math.round(performance.now() - startTime);

        statusOutput.textContent = "Error";
        responseOutput.textContent = `Request failed: ${error.message}`;

        // Record a failed request when the backend returns an HTTP status.
        console.error("API request failed:", error);
    } finally {
        sendButton.disabled = false;
        sendButton.textContent = "Send";
    }
}


/* =====================================
   HISTORY PAGE
===================================== */

const historyContainer = document.getElementById("historyContainer");
const clearHistoryButton = document.getElementById("clearHistory");


async function loadHistory() {
    if (!historyContainer) return;

    historyContainer.textContent = "Loading history...";

    try {
        const data = await apiRequest("/history");

        const history = Array.isArray(data)
            ? data
            : data.history || data.records || [];

        historyContainer.replaceChildren();

        if (history.length === 0) {
            historyContainer.textContent = "No request history found.";
            return;
        }

        history.forEach((item) => {
            const card = document.createElement("div");
            card.className = "history-item";

            // HTTP method
            const method = document.createElement("strong");
            method.textContent = item.method || "UNKNOWN";

            // Request URL
            const url = document.createElement("p");
            url.textContent = item.url || "URL unavailable";

            // Actual HTTP status
            const status = document.createElement("p");
            status.textContent =
                `Status: ${item.status ?? "Unknown"}`;

            // Response time: support different backend field names
            
            // Response time
            
            // Response time: support all field-name variations
            const responseTime =
                item.responseTime ??
                item.responsetime ??
                item.response_time ??
                item.latency;

            const time = document.createElement("p");

            time.textContent =
                responseTime !== null &&
                responseTime !== undefined &&
                responseTime !== "" &&
                Number.isFinite(Number(responseTime))
                    ? `Response time: ${Number(responseTime)} ms`
                    : "Response time: Not available";

            // Display request information
            card.append(method, url, status, time);
            historyContainer.appendChild(card);
        });

    } catch (error) {
        historyContainer.textContent =
            `Unable to load history: ${error.message}`;
    }
}


/* Load history when clicking the History navigation item */
document.querySelectorAll("[data-view='history']").forEach((button) => {
    button.addEventListener("click", loadHistory);
});

/* Clear history */
if (clearHistoryButton) {
    clearHistoryButton.addEventListener("click", async () => {
        const confirmed = confirm(
            "Are you sure you want to clear your request history?"
        );

        if (!confirmed) return;

        try {
            await apiRequest("/history", {
                method: "DELETE"
            });

            await loadHistory();
            alert("Request history cleared successfully.");
        } catch (error) {
            alert(`Unable to clear history: ${error.message}`);
        }
    });
}


/* =====================================
   PERFORMANCE TRACKER
===================================== */

/* Clear performance records */
const clearPerformanceButton = $("#clearPerformance");

if (clearPerformanceButton) {
    clearPerformanceButton.addEventListener("click", async () => {
        const confirmed = confirm(
            "Are you sure you want to clear all performance records?"
        );

        if (!confirmed) return;

        clearPerformanceButton.disabled = true;
        clearPerformanceButton.textContent = "Clearing...";

        try {
            await apiRequest("/performance", {
                method: "DELETE"
            });

            await loadPerformance();

            alert("Performance data cleared successfully.");
        } catch (error) {
            alert(`Unable to clear performance data: ${error.message}`);
        } finally {
            clearPerformanceButton.disabled = false;
            clearPerformanceButton.textContent = "Clear Performance Data";
        }
    });
}


async function loadPerformance() {
    const totalRequestsOutput = $("#totalRequests");
    const passedRequestsOutput = $("#passedRequests");
    const failedRequestsOutput = $("#failedRequests");
    const averageResponseTimeOutput = $("#averageResponseTime");
    const performanceContainer = $("#performanceContainer");

    if (performanceContainer) {
        performanceContainer.textContent = "Loading performance data...";
    }

    try {
        // Fetch performance data from your backend
        const data = await apiRequest("/performance");

        console.log("Performance API response:", data);

        const summary = data.summary || {};
        const records = Array.isArray(data.records)
            ? data.records
            : [];

        // Update dashboard statistics
        if (totalRequestsOutput) {
            totalRequestsOutput.textContent =
                summary.totalRequests ??
                summary.total ??
                records.length;
        }

        if (passedRequestsOutput) {
            passedRequestsOutput.textContent =
                summary.passedRequests ??
                summary.passed ??
                summary.successfulRequests ??
                0;
        }

        if (failedRequestsOutput) {
            failedRequestsOutput.textContent =
                summary.failedRequests ??
                summary.failed ??
                0;
        }

        if (averageResponseTimeOutput) {
            const average =
                summary.averageResponseTime ??
                summary.avgLatency ??
                summary.averageLatency ??
                summary.avgResponseTime ??
                0;

            averageResponseTimeOutput.textContent =
                `${Number(average).toFixed(2)} ms`;
        }

        // Display individual request records
        if (!performanceContainer) return;

        performanceContainer.replaceChildren();

        if (records.length === 0) {
            performanceContainer.textContent =
                "No performance records found yet.";
            return;
        }

        records.forEach((item) => {
            const card = document.createElement("div");
            card.className = "performance-item";

            const method = document.createElement("strong");
            method.textContent = item.method || "UNKNOWN";

            const url = document.createElement("p");
            url.textContent = item.url || "URL unavailable";

            const status = document.createElement("p");
            status.textContent =
                `Status: ${item.status ?? "Unknown"}`;

            const latency =
                item.latency ??
                item.responseTime ??
                item.response_time;

            const time = document.createElement("p");
            time.textContent =
                latency !== null &&
                latency !== undefined &&
                Number.isFinite(Number(latency))
                    ? `Response time: ${Number(latency)} ms`
                    : "Response time: Not available";

            card.append(method, url, status, time);
            performanceContainer.appendChild(card);
        });

    } catch (error) {
        console.error("Unable to load performance data:", error);

        if (performanceContainer) {
            performanceContainer.textContent =
                `Unable to load performance data: ${error.message}`;
        }
    }
}

/* Load performance data when opening the Performance page */
document.querySelectorAll("[data-view='performance']").forEach((button) => {
    button.addEventListener("click", loadPerformance);
});


/* =====================================
   VARIABLES PAGE
===================================== */

const variableForm = document.getElementById("variableForm");
const variableKeyInput = document.getElementById("variableKey");
const variableValueInput = document.getElementById("variableValue");
const variablesContainer = document.getElementById("variablesContainer");

// Load saved variables from the backend
async function loadVariables() {
    if (!variablesContainer) return;

    variablesContainer.textContent = "Loading variables...";

    try {
        const data = await apiRequest("/variables");

        const variables = Array.isArray(data)
            ? data
            : data.variables || [];

        variablesContainer.replaceChildren();

        if (variables.length === 0) {
            variablesContainer.textContent = "No saved variables yet.";
            return;
        }

        variables.forEach((item) => {
            const card = document.createElement("div");
            card.className = "variable-item";

            const name = document.createElement("strong");
            name.textContent = item.var_key;

            const value = document.createElement("p");
            value.textContent = item.var_value;

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.textContent = "Delete";

            deleteButton.addEventListener("click", async () => {
                if (!confirm(`Delete variable "${item.var_key}"?`)) {
                    return;
                }

                deleteButton.disabled = true;

                try {
                    await apiRequest(`/variables/${item.id}`, {
                        method: "DELETE"
                    });

                    await loadVariables();
                } catch (error) {
                    alert(`Unable to delete variable: ${error.message}`);
                    deleteButton.disabled = false;
                }
            });

            card.append(name, value, deleteButton);
            variablesContainer.appendChild(card);
        });
    } catch (error) {
        variablesContainer.textContent =
            `Unable to load variables: ${error.message}`;
        console.error("Load variables error:", error);
    }
}

// Save a variable
variableForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const key = variableKeyInput.value.trim();
    const value = variableValueInput.value;

    if (!key) {
        alert("Please enter a variable name.");
        return;
    }

    const saveButton = variableForm.querySelector(
        'button[type="submit"]'
    );

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
        await apiRequest("/variables", {
            method: "POST",
            body: JSON.stringify({ key, value })
        });

        variableValueInput.value = "";

        await loadVariables();

        alert(`Variable "${key}" saved successfully.`);
    } catch (error) {
        alert(`Unable to save variable: ${error.message}`);
        console.error("Save variable error:", error);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save Variable";
    }
});

// Load variables when opening the Variables page
document.querySelectorAll('[data-view="variables"]').forEach((button) => {
    button.addEventListener("click", loadVariables);
});


/* =====================================
   21. INITIALIZATION
===================================== */

updateResolvedUrl();
updateAccountInfo();

if (getToken()) {
    showView("dashboard");
} else {
    showView("auth");
}

showAuthTab("login");

console.log("API Tester frontend initialized.");
