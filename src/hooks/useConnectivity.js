import { useEffect, useState } from "react";

export function useConnectivity() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [isServerReachable, setIsServerReachable] = useState(true);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [ariaMessage, setAriaMessage] = useState("");

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const onOffline = () => {
      setShowOfflineBanner(true);
      setAriaMessage("You are offline");
    };
    const onOnline = () => {
      setShowOfflineBanner(false);
      setAriaMessage("Connection restored");
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const checkConnectivity = async () => {
      try {
        const res = await fetch("/health", {
          method: "HEAD",
          signal: AbortSignal.timeout(3000)
        });

        if (cancelled) return;
        const ok = res.ok || res.status < 500;
        setIsServerReachable(ok);
        if (ok) {
          setAriaMessage("Server reachable");
        }
      } catch {
        if (cancelled) return;
        setIsServerReachable(false);
        setAriaMessage("Server is unreachable");
      }
    };

    const handleOnline = () => checkConnectivity();
    const handleOffline = () => setIsServerReachable(false);
    const interval = setInterval(checkConnectivity, 30000);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    checkConnectivity();

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const checkServerNow = async (focusTarget = null) => {
    try {
      const res = await fetch("/health", { method: "HEAD", signal: AbortSignal.timeout(3000) });
      const ok = res.ok || res.status < 500;
      setIsServerReachable(ok);
      setAriaMessage(ok ? "Server reachable" : "Server still unreachable");
      focusTarget?.focus?.();
    } catch {
      setIsServerReachable(false);
      setAriaMessage("Server still unreachable");
      focusTarget?.focus?.();
    }
  };

  return {
    isOnline,
    isServerReachable,
    showOfflineBanner,
    ariaMessage,
    setAriaMessage,
    checkServerNow,
    setShowOfflineBanner,
    setIsServerReachable
  };
}
