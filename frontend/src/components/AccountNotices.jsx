import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { getNotifications, markNotificationRead } from "../data/notificationsApi";

export function AccountNotices() {
  const { pathname } = useLocation();
  const root = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getNotifications(controller.signal)
      .then((data) => {
        setItems(data.items);
        setError("");
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });
    return () => controller.abort();
  }, [pathname]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutside(event) {
      if (!root.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function dismiss(id) {
    setError("");
    try {
      await markNotificationRead(id);
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  const count = items.length;
  const label = count === 1 ? "Notifications, 1 unread" : `Notifications, ${count} unread`;

  return (
    <div className="notice-menu" ref={root}>
      <button
        type="button"
        className="notice-button"
        aria-label={label}
        aria-expanded={open}
        aria-controls="account-notices"
        onClick={() => setOpen((current) => !current)}
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
          {count === 0 && !error && <p className="notice-empty">No notifications.</p>}
          {count > 0 && (
            <ul className="notice-list">
              {items.map((item) => (
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
