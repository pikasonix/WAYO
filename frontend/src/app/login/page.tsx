"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useLoginMutation } from "@/lib/redux/services/auth";
import Link from "next/link";
import { supabase } from "../../../supabase/client";


/**
 * Login form content component that uses useSearchParams
 */
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified");
  const [login, { isLoading, error }] = useLoginMutation();
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [verificationMessage, setVerificationMessage] = useState("");



  /**
   * Check for verification status on component mount
   */
  useEffect(() => {
    if (verified === "pending") {
      setVerificationMessage(
        "Vui lòng kiểm tra email của bạn để xác minh tài khoản trước khi đăng nhập."
      );
    }
  }, [verified]);

  /**
   * Handle input change
   */

  const handleOAuthLogin = async (provider: 'google' | 'facebook') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
    });

    if (error) {
      console.error("OAuth login error:", error);
      alert("Không thể đăng nhập bằng " + provider);
    }
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setCredentials({
      ...credentials,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const result = await login({
        email: credentials.email,
        password: credentials.password,
      }).unwrap();

      if (result.session) {
        router.push("/profile");
      }
    } catch (err) {
      // Error is handled by the RTK Query hook
      console.error(err);
    }
  };

  // Check if error exists and render error message
  const hasError = error != null;

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 pb-12 pt-16">
      <div className="w-full max-w-md">
        {/* Logo and header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <Image
              src={process.env.NEXT_PUBLIC_LOGO_WAYO || "/favicon.png"}
              alt="WAYO Logo"
              width={32}
              height={32}
              className="rounded-md"
            />
            <span className="font-semibold text-xl">WAYO</span>
          </Link>
          <h1 className="text-2xl font-bold mb-2">Đăng nhập vào tài khoản</h1>
          <p className="text-gray-600">
            Chào mừng trở lại! Vui lòng nhập thông tin của bạn.
          </p>
        </div>

        {/* Login form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {verificationMessage && (
              <div className="p-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 text-sm">
                {verificationMessage}
              </div>
            )}

            {hasError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-100 text-sm">
                Email hoặc mật khẩu không hợp lệ. Vui lòng thử lại.
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nhập email của bạn"
                value={credentials.email}
                onChange={handleChange}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <input
                    id="rememberMe"
                    name="rememberMe"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                    checked={credentials.rememberMe}
                    onChange={handleChange}
                  />
                  <label
                    htmlFor="rememberMe"
                    className="ml-2 block text-sm text-gray-700"
                  >
                    Ghi nhớ tôi
                  </label>
                </div>
                <div>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                value={credentials.password}
                onChange={handleChange}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>

          {/* <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                className="flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  className="mr-2"
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </button>
              <button
                type="button"
                className="flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  className="mr-2"
                >
                  <path
                    fill="currentColor"
                    d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.351C0 23.407.593 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.73 0 1.323-.593 1.323-1.325V1.325C24 .593 23.407 0 22.675 0z"
                  />
                </svg>
                Facebook
              </button>
            </div>
          </div>  */}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={() => handleOAuthLogin('google')}
            className="flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Image src="/companies/google_icon-icons.com_62736.svg" width={20} height={20} alt="Google" className="mr-2" />

            Đăng nhập bằng Google
          </button>
        </div>

        {/* Sign up link */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-600">
            Chưa có tài khoản?{" "}
            <Link
              href="/signup"
              className="text-blue-600 hover:text-blue-800 font-medium underline"
            >
              Đăng ký
            </Link>
          </p>
          <div style={{ textAlign: 'center', marginTop: 100 }}>



          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Login page component with Suspense boundary
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Đang tải...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
