import { useState } from "react";
import type { FormEvent } from "react";
import { login } from "../api";
import type { Role } from "../types";
import { LogoIcon } from "./icons";

interface Props {
  onSuccess: (role: Role) => void;
}

export function LoginScreen({ onSuccess }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const role = await login(password);
      onSuccess(role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={handleSubmit}>
        <span className="brand-mark login-mark">
          <LogoIcon />
        </span>
        <h1>株式ポートフォリオ管理</h1>
        <p className="login-sub">パスワードを入力してください</p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          placeholder="パスワード"
          value={password}
          disabled={busy}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={busy || !password}>
          {busy ? "確認中..." : "ログイン"}
        </button>
        {error && <p className="form-error">{error}</p>}
      </form>
    </div>
  );
}
