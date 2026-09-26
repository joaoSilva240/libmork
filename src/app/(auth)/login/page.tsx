'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { Input, Button, Form, Spinner } from '@/components/ui';
import { getSafeRedirect } from '@/lib/auth/redirect';
import { useSocket } from '@/context/SocketContext';

const BUTTON_IMAGES = [
  '/Buttons/Button 1.png',
  '/Buttons/Button 2.png',
  '/Buttons/Button 3.png',
  '/Buttons/Button 4.png',
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { socket } = useSocket();
  const redirect = getSafeRedirect(searchParams.get('redirect'));
  const errorParam = searchParams.get('error');

  const [authMode, setAuthMode] = useState<'credentials' | 'qrcode'>('credentials');

  // QR Code State
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [qrAuthUrl, setQrAuthUrl] = useState<string | null>(null);
  const [qrCountdown, setQrCountdown] = useState<number>(120);
  const [isQrLoading, setIsQrLoading] = useState<boolean>(false);
  const [qrError, setQrError] = useState<string | null>(null);

  const loginFailedMessage =
    errorParam === 'login_failed'
      ? 'E-mail ou senha inválidos. Se o problema persistir, verifique o cadastro.'
      : errorParam === 'account_linking_required'
      ? 'Já existe uma conta com este e-mail. Faça login normalmente para vincular sua conta Discord.'
      : errorParam === 'discord_email_unverified'
      ? 'Seu e-mail no Discord não está verificado ou não foi compartilhado. Verifique sua conta no Discord e tente novamente.'
      : errorParam === 'oauth_state_invalid'
      ? 'Sessão de autenticação expirada ou inválida. Tente novamente.'
      : errorParam === 'oauth_access_denied'
      ? 'Acesso cancelado pelo usuário no Discord.'
      : errorParam?.startsWith('oauth_')
      ? 'Falha ao autenticar com Discord. Tente novamente.'
      : undefined;

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [buttonImage, setButtonImage] = useState<string>(BUTTON_IMAGES[0]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * BUTTON_IMAGES.length);
      setButtonImage(BUTTON_IMAGES[randomIndex]);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const generateQrCode = useCallback(async () => {
    setIsQrLoading(true);
    setQrError(null);
    setQrCountdown(120);

    try {
      const res = await fetch('/api/auth/qr/generate', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setQrError(data.error || 'Erro ao gerar QR Code');
        return;
      }

      setQrSessionId(data.qrSessionId);
      const fullUrl = `${window.location.origin}${data.authUrl}`;
      setQrAuthUrl(fullUrl);

      socket?.emit('join-qr-session', { qrSessionId: data.qrSessionId });
    } catch {
      setQrError('Erro de conexão ao gerar QR Code.');
    } finally {
      setIsQrLoading(false);
    }
  }, [socket]);

  useEffect(() => {
    if (authMode === 'qrcode' && !qrSessionId) {
      generateQrCode();
    }
  }, [authMode, qrSessionId, generateQrCode]);

  // Timer do QR Code
  useEffect(() => {
    if (authMode !== 'qrcode' || !qrSessionId || qrCountdown <= 0) return;

    const timer = setInterval(() => {
      setQrCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [authMode, qrSessionId, qrCountdown]);

  // Handler de login efetuado com sucesso via QR Code
  const handleQrLoginSuccess = useCallback(() => {
    const targetUrl = redirect || '/';
    window.location.href = targetUrl;
  }, [redirect]);

  // Escuta WebSocket para aprovação do QR Code
  useEffect(() => {
    if (!socket || !qrSessionId || authMode !== 'qrcode') return;

    const handleQrAuth = () => {
      handleQrLoginSuccess();
    };

    socket?.on('qr-authenticated', handleQrAuth);
    return () => {
      socket?.off('qr-authenticated', handleQrAuth);
    };
  }, [socket, qrSessionId, authMode, handleQrLoginSuccess]);

  // Fallback Polling para checar status do QR Code
  useEffect(() => {
    if (authMode !== 'qrcode' || !qrSessionId || qrCountdown <= 0) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/qr/check?token=${qrSessionId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'AUTHENTICATED') {
            clearInterval(interval);
            handleQrLoginSuccess();
          }
        }
      } catch {
        // Ignora falhas temporárias de polling
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [authMode, qrSessionId, qrCountdown, handleQrLoginSuccess]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          const fieldErrors: Record<string, string> = {};
          data.errors.forEach((err: { path: string[]; message: string }) => {
            fieldErrors[err.path[0]] = err.message;
          });
          setErrors(fieldErrors);
        } else {
          setErrors({ general: data.error || 'Erro ao fazer login' });
        }
        return;
      }

      const targetUrl = data.data?.redirect || redirect || '/';
      window.location.href = targetUrl;
    } catch {
      setErrors({ general: 'Erro de conexão. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-dominant-deep text-secondary-pure px-4 py-8 lg:px-0 lg:py-0">
      {/* Lado Esquerdo - Formulário de Login (50% em desktop) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-0 lg:p-12 bg-dominant-dark">
        <div className="max-w-md w-full space-y-6 bg-secondary-card p-8 rounded-xl border border-dominant-border shadow-xl lg:bg-transparent lg:p-0 lg:rounded-none lg:border-0 lg:shadow-none">
          <div>
            <h1 className="text-3xl font-bold text-center text-secondary-pure">
              Login
            </h1>
            <p className="mt-2 text-center text-sm text-secondary-muted">
              Entre na sua conta do Libmork
            </p>
          </div>

          {/* Abas de Modo de Autenticação */}
          <div className="flex rounded-lg border border-gray-800 bg-gray-950 p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => setAuthMode('credentials')}
              className={`flex-1 rounded-md py-2 transition-all ${
                authMode === 'credentials'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              E-mail e Senha
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('qrcode')}
              className={`flex-1 rounded-md py-2 transition-all ${
                authMode === 'qrcode'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              📱 QR Code Celular
            </button>
          </div>

          {authMode === 'credentials' ? (
            <Form
              method="post"
              action="/api/auth/login"
              onSubmit={handleSubmit}
              error={errors.general || loginFailedMessage}
            >
              <input type="hidden" name="redirect" value={redirect || ''} />
              <Input
                label="E-mail"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                required
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={isLoading}
              />

              <Input
                label="Senha"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                required
                autoComplete="current-password"
                disabled={isLoading}
              />

              <Button
                type="submit"
                className="w-full h-20 min-h-[70px]"
                bgImage={buttonImage}
                isLoading={isLoading}
              >
                Entrar
              </Button>
            </Form>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4 rounded-xl border border-gray-800 bg-gray-950/60 p-6 text-center">
              {isQrLoading ? (
                <div className="py-12">
                  <Spinner size="lg" />
                  <p className="mt-4 text-xs text-gray-400">Gerando QR Code de acesso...</p>
                </div>
              ) : qrError ? (
                <div className="py-6">
                  <p className="text-sm text-red-400">{qrError}</p>
                  <button
                    type="button"
                    onClick={generateQrCode}
                    className="mt-4 rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500"
                  >
                    Tentar Novamente
                  </button>
                </div>
              ) : qrCountdown <= 0 ? (
                <div className="py-6">
                  <span className="text-3xl block mb-2">⏳</span>
                  <p className="text-sm font-semibold text-amber-400">QR Code Expirado</p>
                  <p className="text-xs text-gray-400 mb-4">O tempo limite de 2 minutos foi atingido.</p>
                  <button
                    type="button"
                    onClick={generateQrCode}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500"
                  >
                    Gerar Novo QR Code
                  </button>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border-4 border-purple-500/30 bg-white p-3 shadow-[0_0_25px_rgba(168,85,247,0.2)]">
                    {qrAuthUrl && <QRCodeSVG value={qrAuthUrl} size={180} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Escaneie com a câmera do celular</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Você precisa estar logado no aplicativo/navegador do celular para autorizar.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-purple-900/60 bg-purple-950/40 px-3 py-1 text-xs text-purple-300">
                    <span>⏱️ Expira em:</span>
                    <span className="font-mono font-bold">{qrCountdown}s</span>
                  </div>
                </>
              )}
            </div>
          )}

          <a
            href={`/api/auth/discord?redirect=${encodeURIComponent(redirect || '/')}`}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-[#5865F2] bg-[#5865F2] font-medium text-white transition-opacity hover:opacity-90"
          >
            Continuar com Discord
          </a>

          <p className="text-center text-sm text-secondary-muted">
            Não tem uma conta?{' '}
            <Link href="/register" className="font-medium text-accent hover:text-accent-hover transition-colors">
              Criar conta
            </Link>
          </p>
        </div>
      </div>

      {/* Lado Direito - Wallpaper (50% em desktop) */}
      <div className="hidden lg:block lg:w-1/2 relative bg-dominant-pure">
        <img
          src="/wallpaperflare-cropped.jpg"
          alt="Libmork Wallpaper"
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-dominant-dark/80 to-transparent" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

