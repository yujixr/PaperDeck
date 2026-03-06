import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api, type Conference } from "../api";
import { useAuth } from "../auth/AuthProvider";
import { type ConferenceFilter, useConferenceFilter } from "../context/ConferenceFilterContext";
import { Button } from "./Button";
import "./SettingsDialog.css";

export function SettingsDialog({ trigger }: { trigger?: React.ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { user, logout } = useAuth();
  const { filter, setFilter } = useConferenceFilter();
  const [localFilter, setLocalFilter] = useState<ConferenceFilter | null>(filter);

  const { data: conferences } = useQuery({
    queryKey: ["conferences"],
    queryFn: () => api.getConferences(),
  });

  const open = () => {
    setLocalFilter(filter);
    dialogRef.current?.showModal();
  };
  const close = () => {
    setFilter(localFilter);
    dialogRef.current?.close();
  };

  const handleFilterChange = (value: string) => {
    if (value === "") {
      setLocalFilter(null);
    } else {
      const [conference, year] = value.split("|");
      setLocalFilter({ conference, year });
    }
  };

  const currentValue = localFilter ? `${localFilter.conference}|${localFilter.year}` : "";

  return (
    <>
      {trigger ? (
        <button type="button" className="nav-link-trigger" onClick={open}>
          {trigger}
        </button>
      ) : (
        <Button variant="default" size="small" onClick={open}>
          設定
        </Button>
      )}
      <dialog
        ref={dialogRef}
        className="settings-dialog"
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
      >
        <div className="settings-dialog-content">
          <div className="settings-dialog-header">
            <h2>設定</h2>
            <button type="button" className="settings-dialog-close" onClick={close}>
              ✕
            </button>
          </div>

          <div className="settings-section">
            <span className="settings-label">アカウント</span>
            <p className="settings-value">{user?.username}</p>
          </div>

          <div className="settings-section">
            <label className="settings-label" htmlFor="conference-filter">
              学会フィルタ
            </label>
            <select
              id="conference-filter"
              className="settings-select"
              value={currentValue}
              onChange={(e) => handleFilterChange(e.target.value)}
            >
              <option value="">すべて</option>
              {conferences?.map((c: Conference) => (
                <option key={`${c.name}|${c.year}`} value={`${c.name}|${c.year}`}>
                  {c.name} {c.year}
                </option>
              ))}
            </select>
          </div>

          <div className="settings-section settings-logout">
            <Button variant="default" size="medium" onClick={logout} fullWidth>
              ログアウト
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
