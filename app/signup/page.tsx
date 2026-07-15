"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { signUpManager } from "@/app/lib/auth";

export default function SignUpPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [signupSecret, setSignupSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isPasswordMatched = useMemo(
    () => !passwordConfirm || password === passwordConfirm,
    [password, passwordConfirm],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !email.trim() || !password || !passwordConfirm || !signupSecret.trim()) {
      setError("모든 항목을 입력해 주세요.");
      return;
    }

    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    if (!isPasswordMatched) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    try {
      const result = await signUpManager({
        username: username.trim(),
        email: email.trim(),
        password,
        signupSecret: signupSecret.trim(),
      });

      if (!result.ok) {
        setError(result.message ?? "회원가입에 실패했습니다.");
        return;
      }

      router.push(`/login?signup=1&username=${encodeURIComponent(username.trim())}`);
    } catch {
      setError("회원가입 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
          ZeroQ Admin
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">MANAGER 회원가입</h1>
        <p className="mt-2 text-sm text-slate-600">
          이 페이지에서 생성되는 계정은 자동으로 <strong>MANAGER</strong> 권한으로 등록됩니다.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-700">
              아이디
            </label>
            <input
              id="username"
              type="text"
              required
              maxLength={255}
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-orange-500"
              placeholder="manager01"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              이메일
            </label>
            <input
              id="email"
              type="email"
              required
              maxLength={255}
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-orange-500"
              placeholder="manager@zeroq.kr"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              maxLength={255}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-orange-500"
              placeholder="8자 이상"
            />
          </div>

          <div>
            <label htmlFor="passwordConfirm" className="mb-1 block text-sm font-medium text-slate-700">
              비밀번호 확인
            </label>
            <input
              id="passwordConfirm"
              type="password"
              required
              minLength={8}
              maxLength={255}
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-orange-500"
              placeholder="비밀번호 재입력"
            />
            {!isPasswordMatched ? (
              <p className="mt-1 text-xs text-red-600">비밀번호가 일치하지 않습니다.</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="signupSecret" className="mb-1 block text-sm font-medium text-slate-700">
              관리자 가입 비밀번호
            </label>
            <input
              id="signupSecret"
              type="password"
              required
              autoComplete="off"
              maxLength={255}
              value={signupSecret}
              onChange={(event) => setSignupSecret(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-orange-500"
              placeholder="발급받은 가입 코드 입력"
            />
            <p className="mt-1 text-xs text-slate-500">
              운영자가 별도로 전달한 가입 코드가 있어야 MANAGER 계정을 만들 수 있습니다.
            </p>
          </div>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-orange-400"
          >
            {loading ? "가입 중..." : "회원가입"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600">
          이미 계정이 있나요?{" "}
          <Link href="/login" className="font-semibold text-orange-600 hover:underline">
            로그인으로 이동
          </Link>
        </div>
      </div>
    </div>
  );
}
