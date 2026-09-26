import { useCallback, useEffect, useRef, useState } from "react";

function normalizeSafeArea(value) {
  const source = value?.insets ?? value ?? {};

  return {
    top: Number(source.top ?? 0),
    right: Number(source.right ?? 0),
    bottom: Number(source.bottom ?? 0),
    left: Number(source.left ?? 0),
  };
}

export function useMcpBridge() {
  const [project, setProject] = useState(null);
  const [workspaceView, setWorkspaceView] = useState(null);
  const [detailView, setDetailView] = useState(null);
  const [activeAction, setActiveAction] = useState(null);
  const [bridgeError, setBridgeError] = useState(null);
  const [displayMode, setDisplayMode] = useState(
    typeof window !== "undefined"
      ? window.openai?.displayMode ?? "inline"
      : "inline",
  );
  const [safeAreaInsets, setSafeAreaInsets] = useState(() =>
    normalizeSafeArea(
      typeof window !== "undefined" ? window.openai?.safeArea : null,
    ),
  );

  const pending = useRef(new Map());
  const rpcId = useRef(0);
  const initialized = useRef(null);

  const applyResult = useCallback((result) => {
    const structured = result?.structuredContent ?? result ?? {};
    const metadata =
      result?._meta ??
      result?.mcp_tool_result?._meta ??
      result?.call_tool_result?._meta ??
      {};

    if (structured.project) {
      setProject(structured.project);
    }

    const uiView = metadata.erpUi ?? null;
    if (!uiView?.presentation?.renderer || !uiView?.data) return;

    if (uiView.slot === "detail") {
      setDetailView(uiView);
      return;
    }

    setWorkspaceView(uiView);
    setDetailView(null);
  }, []);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.source !== window.parent) return;

      const message = event.data;
      if (!message || message.jsonrpc !== "2.0") return;

      if (typeof message.id === "number") {
        const waiter = pending.current.get(message.id);
        if (!waiter) return;

        pending.current.delete(message.id);
        if (message.error) waiter.reject(message.error);
        else waiter.resolve(message.result);
        return;
      }

      if (message.method === "ui/notifications/tool-result") {
        applyResult(message.params);
      }

      if (message.method === "ui/notifications/host-context-changed") {
        const nextMode = message.params?.displayMode;
        if (nextMode) setDisplayMode(nextMode);

        if (message.params?.safeAreaInsets) {
          setSafeAreaInsets(normalizeSafeArea(message.params.safeAreaInsets));
        }
      }
    };

    const onGlobals = (event) => {
      const nextMode = event?.detail?.globals?.displayMode;
      if (nextMode) setDisplayMode(nextMode);

      const nextSafeArea = event?.detail?.globals?.safeArea;
      if (nextSafeArea) {
        setSafeAreaInsets(normalizeSafeArea(nextSafeArea));
      }
    };

    window.addEventListener("message", onMessage, { passive: true });
    window.addEventListener("openai:set_globals", onGlobals, { passive: true });

    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("openai:set_globals", onGlobals);
    };
  }, [applyResult]);

  const request = useCallback((method, params) => {
    return new Promise((resolve, reject) => {
      const id = ++rpcId.current;
      pending.current.set(id, { resolve, reject });

      window.parent.postMessage(
        { jsonrpc: "2.0", id, method, params },
        "*",
      );
    });
  }, []);

  const ensureInitialized = useCallback(() => {
    if (!initialized.current) {
      initialized.current = (async () => {
        const result = await request("ui/initialize", {
          appInfo: {
            name: "erp-production-demo-widget",
            version: "0.5.1",
          },
          appCapabilities: {
            availableDisplayModes: ["inline", "fullscreen"],
          },
          protocolVersion: "2026-01-26",
        });

        const initialMode = result?.hostContext?.displayMode;
        if (initialMode) setDisplayMode(initialMode);

        if (result?.hostContext?.safeAreaInsets) {
          setSafeAreaInsets(
            normalizeSafeArea(result.hostContext.safeAreaInsets),
          );
        }

        window.parent.postMessage(
          {
            jsonrpc: "2.0",
            method: "ui/notifications/initialized",
            params: {},
          },
          "*",
        );
      })();
    }

    return initialized.current;
  }, [request]);

  useEffect(() => {
    ensureInitialized().catch((error) => {
      setBridgeError(error?.message || "Widget bridge unavailable");
    });
  }, [ensureInitialized]);

  const callTool = useCallback(
    async (name, args = {}) => {
      setActiveAction(name);
      setBridgeError(null);

      try {
        await ensureInitialized();
        const result = await request("tools/call", {
          name,
          arguments: args,
        });

        applyResult(result);
        return result;
      } catch (error) {
        console.error(error);
        setBridgeError(error?.message || "Tool call failed");
        return null;
      } finally {
        setActiveAction(null);
      }
    },
    [applyResult, ensureInitialized, request],
  );

  const requestFullscreen = useCallback(async () => {
    setBridgeError(null);

    try {
      await ensureInitialized();
      await request("ui/request-display-mode", { mode: "fullscreen" });
      setDisplayMode("fullscreen");
      return;
    } catch (error) {
      if (window.openai?.requestDisplayMode) {
        try {
          await window.openai.requestDisplayMode({ mode: "fullscreen" });
          setDisplayMode("fullscreen");
          return;
        } catch (fallbackError) {
          console.error(fallbackError);
        }
      }

      console.error(error);
      setBridgeError("無法開啟全螢幕工作台");
    }
  }, [ensureInitialized, request]);

  return {
    project,
    workspaceView,
    detailView,
    clearDetail: () => setDetailView(null),
    activeAction,
    bridgeError,
    callTool,
    displayMode,
    safeAreaInsets,
    requestFullscreen,
  };
}
