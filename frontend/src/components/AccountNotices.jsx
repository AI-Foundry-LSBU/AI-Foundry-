import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { getNotifications, markNotificationRead } from "../data/notificationsApi";

export function AccountNotices() {
  const { pathname } = useLocation();
  const root = useRef(null);
  const openRef = useRef(false);
  const marksInFlight = useRef(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [shown, setShown] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getNotifications(controller.signal)
      .then((data) => {
        if (marksInFlight.current > 0) return;
        setError("");
        if (openRef.current && data.items.length > 0) {
          markSeen(data.items);
          return;
        }
        setItems(data.items);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });
    return () => controller.abort();
  }, [pathname]);

  useEffect(() => {
    openRef.current = false;
    setOpen(false);
    setShown([]);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutside(event) {
      if (!root.current?.contains(event.target)) closePanel();
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") closePanel();
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function markSeen(viewing) {
    if (viewing.length === 0) return;
    marksInFlight.current += 1;
    setShown(viewing);
    setItems([]);
    const failed = [];
    try {
      for (const item of viewing) {
        try {
          await markNotificationRead(item.id);
        } catch (err) {
          failed.push(item);
          setError(err.message);
        }
      }
    } finally {
      marksInFlight.current -= 1;
      if (failed.length > 0) setItems(failed);
    }
  }

  function closePanel() {
    openRef.current = false;
    setOpen(false);
    setShown([]);
  }

  function toggleOpen() {
    if (open) {
      closePanel();
      return;
    }
    openRef.current = true;
    setOpen(true);
    markSeen(items);
  }

  async function dismiss(id) {
    setError("");
    try {
      await markNotificationRead(id);
      setShown((current) => current.filter((item) => item.id !== id));
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  const count = items.length;
  const listed = shown.length > 0 ? shown : items;
  const label = count === 1 ? "Notifications, 1 unread" : `Notifications, ${count} unread`;

  return (
    <div className="notice-menu" ref={root}>
      <button
        type="button"
        className="notice-button"
        aria-label={label}
        aria-expanded={open}
        aria-controls="account-notices"
        onClick={toggleOpen}
      >
        <Bell size={16} />
        {count > 0 && <span className="notice-count" aria-hidden="true">{count > 9 ? "9+" : count}</span>}
      </button>
      {open && (
        <section className="notice-panel" id="account-notices" aria-label="Notifications">
          <header>
            <strong>Notifications</strong>
            <span>{count === 1 ? "1 unread" : `${count} unread`}</span>
          </header>
          {error && <p role="alert" className="error-text">{error}</p>}
          {listed.length === 0 && !error && <p className="notice-empty">No notifications.</p>}
          {listed.length > 0 && (
            <ul className="notice-list">
              {listed.map((item) => (
                <li key={item.id} className="notice-item">
                  <Link to={`/opportunities/${item.opportunityId}`}>{item.message}</Link>
                  <button type="button" onClick={() => dismiss(item.id)}>Dismiss</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
