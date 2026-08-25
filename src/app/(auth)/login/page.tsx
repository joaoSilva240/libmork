'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Input, Button, Form } from '@/components/ui';
import { getSafeRedirect } from '@/lib/auth/redirect';

const BUTTON_IMAGES = [
  '/Buttons/Button 1.png',
  '/Buttons/Button 2.png',
  '/Buttons/Button 3.png',
  '/Buttons/Button 4.png',
];

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
  const [buttonImage, setButtonImage] = useState<string>(BUTTON_IMAGES[0]);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * BUTTON_IMAGES.length);
    setButtonImage(BUTTON_IMAGES[randomIndex]);
  }, []);

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

      const targetUrl = data.data?.redirect || redirect || (data.data?.role === "master" ? "/master" : "/player");
      window.location.href = targetUrl;
    } catch {
      setErrors({ general: 'Erro de conexão. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-dominant-deep text-secondary-pure">
      {/* Lado Esquerdo - Formulário de Login (50% em desktop) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-12 bg-dominant-dark">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-center text-secondary-pure">
              Login
            </h1>
            <p className="mt-2 text-center text-sm text-secondary-muted">
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

            <Button
              type="submit"
              className="w-full h-20 min-h-[70px]"
              bgImage={buttonImage}
              isLoading={isLoading}
            >
              Entrar
            </Button>
          </Form>

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
