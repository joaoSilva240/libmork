'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Input, Button, Form } from '@/components/ui';
import { getSafeRedirect } from '@/lib/auth/redirect';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = getSafeRedirect(searchParams.get('redirect'));
  const loginFailedMessage = searchParams.get('error') === 'login_failed'
    ? 'E-mail ou senha inválidos. Se o problema persistir, verifique o cadastro.'
    : undefined;
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Limpar erro do campo ao digitar
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
          // Erros de validação do Zod
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

      // NAVEGAÇÃO COMPLETA DE DOCUMENTO:
      // O uso de window.location.href em vez de router.push é essencial para garantir
      // que navegadores móveis (iOS Safari e Android Chrome) descarreguem os cookies de sessão HTTP-only
      // no cookie jar do dispositivo antes de realizar a requisição da página inicial (/player ou /master).
      const targetUrl = data.data?.redirect || redirect || (data.data?.role === "master" ? "/master" : "/player");
      window.location.href = targetUrl;
    } catch {
      setErrors({ general: 'Erro de conexão. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gray-50">
      {/* Lado Esquerdo - Formulário de Login (50% em desktop) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-12">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-center text-gray-900">
              Login
            </h1>
            <p className="mt-2 text-center text-sm text-gray-600">
              Entre na sua conta do Libmork
            </p>
          </div>

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

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Entrar
            </Button>
          </Form>

          <p className="text-center text-sm text-gray-600">
            Não tem uma conta?{' '}
            <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
              Criar conta
            </Link>
          </p>
        </div>
      </div>

      {/* Lado Direito - Wallpaper (50% em desktop) */}
      <div className="hidden lg:block lg:w-1/2 relative bg-gray-900">
        <img
          src="/wallpaperflare-cropped.jpg"
          alt="Libmork Wallpaper"
          className="absolute inset-0 w-full h-full object-cover"
        />
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
